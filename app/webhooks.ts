import { intersect } from "https://deno.land/std@0.161.0/collections/intersect.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.1";
import { env } from "./env.ts";
import { privateKey } from "./redis.ts";
import { Deployment, deployment } from "./deploy.ts";
import * as mod from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";

if (!privateKey) {
  throw Error("Private key is not deployed on Upstash Redis.");
}

const app = new App({
  appId: env.APP_ID,
  privateKey,
  oauth: {
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
  },
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
});

type ClientPayloadKeys =
  | "baseBranch"
  | "workingBranch"
  | "autoMerge"
  | "labels"
  | "include"
  | "exclude"
  | "release";

type ClientPayload = {
  [K in ClientPayloadKeys]: string;
};

interface Payload {
  repository: {
    owner: {
      login: string;
    };
    name: string;
    full_name: string;
  };
  client_payload?: Record<string, unknown>;
  check_suite?: {
    head_branch: string | null;
  };
}

type Context = {
  deploy: Deployment;
  owner: string;
  repo: string;
  branch: string | null;
};

const getContext = async (payload: Payload): Promise<Context> => {
  const deploy = await deployment();
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;

  if (payload.client_payload) {
    const inputs = payload.client_payload as ClientPayload;
    const branch = inputs.workingBranch ?? "denopendabot";
    return { deploy, owner, repo, branch };
  }
  if (payload.check_suite) {
    const branch = payload.check_suite.head_branch;
    return { deploy, owner, repo, branch };
  }
  console.error(payload);
  throw new Error("Unsupported tyep of payload");
};

const isTestContext = (context: Context) => {
  const { owner, repo, branch } = context;
  return `${owner}/${repo}` === env.APP_REPO && branch === "test-app";
};

const associated = (context: Context) =>
  context.deploy === "staging"
    ? isTestContext(context)
    : context.branch?.startsWith("denopendabot");

const isDenoProject = async (github: GitHubClient) => {
  const tree = await github.getTree();
  const paths = tree.map((blob) => blob.path!);

  const targets = ["deno.json", "deno.jsonc"];

  return intersect(paths, targets).length > 0;
};

// create .github/workflows/denopendabot.yml in a repository
const createWorkflow = async (
  octokit: Octokit,
  owner: string,
  repo: string,
) => {
  const deploy = await deployment();
  const repository = `${owner}/${repo}`;

  if (deploy === "staging" && repository !== env.APP_REPO) {
    return;
  }
  console.info(`🚀 ${owner} installed Denopendabot to ${owner}/${repo}`);

  const github = new GitHubClient({ octokit, repository });

  if (!(await isDenoProject(github))) {
    console.info("...but it does not seem to be a Deno project");
    return;
  }

  const testing = deploy === "staging";
  const base = testing ? "test/install" : await github.defaultBranch();
  const head = testing ? base + `/${Date.now()}` : "denopendabot/setup";

  const path = ".github/workflows/denopendabot.yml";
  const message = "ci: setup Denopendabot";
  const content = () => Deno.readTextFileSync("./app/denopendabot.yml");

  await github.createCommit(head, message, [{ path, content }]);

  await github.createPullRequest({
    base,
    head,
    title: "Setup Denopendabot",
    modifiable: true,
    labels: testing ? ["test"] : undefined,
  });
};

app.webhooks.on("installation.created", async ({ octokit, payload }) => {
  console.debug(payload);
  if (!payload.repositories) return;
  const owner = payload.sender.login;

  for (const { name: repo } of payload.repositories) {
    await createWorkflow(octokit, owner, repo);
  }
});

app.webhooks.on(
  "installation_repositories.added",
  async ({ octokit, payload }) => {
    console.debug(payload);
    const owner = payload.sender.login;

    for (const { name: repo } of payload.repositories_added) {
      await createWorkflow(octokit, owner, repo);
    }
  },
);

// run update on "denopendabot_run" repsitory-dispatch events
app.webhooks.on("repository_dispatch", async ({ octokit, payload }) => {
  console.debug(payload);

  const context = await getContext(payload);
  const inputs = payload.client_payload as ClientPayload;
  const sender = payload.sender.login;

  if (!associated(context) || payload.action !== "denopendabot-run") return;

  const repository = payload.repository.full_name;

  console.info(`🔥 ${sender} dispatched ${payload.action} at ${repository}`);

  const labels = inputs.labels ? inputs.labels.split(" ") : [];

  if (isTestContext(context)) labels.push("test");
  if (inputs.release) labels.push("release");
  if (inputs.autoMerge) labels.push("auto-merge");

  const options: mod.Options = {
    octokit,
    baseBranch: inputs.baseBranch,
    workingBranch: inputs.workingBranch,
    include: inputs.include ? inputs.include.split(" ") : undefined,
    exclude: inputs.exclude ? inputs.exclude.split(" ") : undefined,
    release: inputs.release ?? undefined,
    labels,
  };

  const updates = await mod.getUpdates(repository, options);
  await mod.createCommits(repository, updates, options);
  await mod.createPullRequest(repository, options);
});

// merge a pull request if all checks have passed
app.webhooks.on("check_suite.completed", async ({ name, octokit, payload }) => {
  console.debug(payload);

  const context = await getContext(payload);
  const { owner, repo } = context;
  const branch = payload[name].head_branch as string;
  const app = payload[name].app.slug;

  // skip if we are not in charge of this webhook
  if (!associated(context)) return;

  // skip if the conclusion is not success
  if (payload.check_suite.conclusion !== "success") return;

  console.info(`✅ ${app} completed a check suite at ${owner}/${repo}`);

  // merge pull requests if the status is success
  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    console.debug(pr);

    // find a pull request created by Denopendabot with a `auto-merge` label
    if (
      pr.user?.login === "denopendabot[bot]" &&
      pr.labels?.find((label) => label.name === "auto-merge")
    ) {
      // Do not merge if another check run is ongoing
      const { data: { check_runs } } = await octokit.request(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        { owner, repo, ref: branch },
      );
      if (check_runs.find((it) => it.status !== "completed")) {
        console.info(`☕ Waiting for another check run to be completed...`);
        return;
      }
      // merge the pull request
      const { data: result } = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        { owner, repo, pull_number: number },
      );
      if (result.merged) {
        console.info(`🎉 Merged a pull request "${pr.title}"`);
      } else {
        console.warn(`❗ ${result.message}`);
      }
    }
  }
});

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
