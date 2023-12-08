import { retry } from "https://deno.land/std@0.208.0/async/mod.ts";
import { intersect } from "https://deno.land/std@0.208.0/collections/intersect.ts";
import { Octokit } from "npm:@octokit/core@5.0.2";
import { App } from "npm:@octokit/app@14.0.2";
import { EmitterWebhookEventName } from "npm:@octokit/webhooks@12.0.10";
import { HonoRequest } from "https://deno.land/x/hono@v3.11.3/mod.ts";
import { env } from "./env.ts";
import { DeployEnv, getThisDeployEnv } from "./deployments.ts";
import * as mod from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";

const app = new App({
  appId: env.APP_ID,
  privateKey: env.PRIVATE_KEY,
  oauth: {
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
  },
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
});

export const octokit = await app.getInstallationOctokit(
  parseInt(env.INSTALLATION_ID),
);

type ClientPayloadKeys =
  | "baseBranch"
  | "workingBranch"
  | "root"
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
  deploy: DeployEnv;
  owner: string;
  repo: string;
  branch: string | null;
};

const getContext = async (payload: Payload): Promise<Context> => {
  const deploy = await getThisDeployEnv();
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
  return `${owner}/${repo}` === env.APP_REPO && branch?.startsWith("test");
};

const isAssociated = (context: Context) => {
  if (context.deploy === "Production") {
    return !isTestContext(context);
  }
  if (context.deploy === "Preview") {
    return isTestContext(context);
  }
  return false;
};

const isDenoProject = async (github: GitHubClient) => {
  const tree = await github.getTree(await github.defaultBranch());
  const paths = tree.map((blob) => blob.path!);

  const targets = ["deno.json", "deno.jsonc"];

  return intersect(paths, targets).length > 0;
};

// create .github/workflows/denopendabot.yml in a repository
const createWorkflow = async (
  octokit: Octokit,
  repository: string,
) => {
  const deploy = await getThisDeployEnv();
  const testing = repository === env.APP_REPO;

  if (deploy === "Production" && testing) return;
  if (deploy === "Preview" && !testing) return;

  const github = new GitHubClient({ octokit, repository });

  if (!(await isDenoProject(github))) return;

  const base = testing ? "test-install" : await github.defaultBranch();
  const head = testing ? base + "-" + Date.now() : "denopendabot-setup";

  const message = "ci: setup Denopendabot";
  const content = await Deno.readTextFile("./app/denopendabot.yml");

  const headSha = await github.createBranch(head);
  const commit = await github.createCommit(headSha, message, [{
    path: ".github/workflows/denopendabot.yml",
    content: () => content,
  }]);
  await github.updateBranch(head, commit.sha);

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
  const sender = payload.sender.login;

  for (const { full_name } of payload.repositories) {
    console.info(`🚀 ${sender} installed Denopendabot to ${full_name}`);
    await createWorkflow(octokit, full_name);
  }
});

app.webhooks.on(
  "installation_repositories.added",
  async ({ octokit, payload }) => {
    console.debug(payload);
    const sender = payload.sender.login;

    for (const { full_name } of payload.repositories_added) {
      console.info(`🚀 ${sender} installed Denopendabot to ${full_name}`);
      await createWorkflow(octokit, full_name);
    }
  },
);

// run update on "denopendabot_run" repsitory-dispatch events
app.webhooks.on("repository_dispatch", async ({ octokit, payload }) => {
  console.debug(payload);

  const context = await getContext(payload);
  const inputs = payload.client_payload as ClientPayload;
  const sender = payload.sender.login;

  if (!isAssociated(context) || payload.action !== "denopendabot-run") return;

  const repository = payload.repository.full_name;

  console.info(`🔥 ${sender} dispatched ${payload.action} at ${repository}`, {
    baseBranch: inputs.baseBranch,
    workingBranch: inputs.workingBranch,
  });

  const labels = inputs.labels ? inputs.labels.split(" ") : [];

  if (isTestContext(context)) labels.push("test");
  if (inputs.release) labels.push("release");
  if (inputs.autoMerge) labels.push("auto-merge");

  const options: mod.Options = {
    octokit,
    baseBranch: inputs.baseBranch,
    workingBranch: inputs.workingBranch,
    root: inputs.root,
    include: inputs.include ? inputs.include.split(" ") : undefined,
    exclude: inputs.exclude ? inputs.exclude.split(" ") : undefined,
    release: inputs.release ?? undefined,
    labels,
  };

  const updates = await retry(
    () => mod.getUpdates(repository, options),
  );
  if (!updates.length) {
    console.info(`👍 ${repository} is up to date`);
    return;
  }

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
  if (!isAssociated(context)) return;

  // skip if the conclusion is not success
  if (payload.check_suite.conclusion !== "success") return;

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
      console.info(`✅ ${app} completed a check suite at ${owner}/${repo}`);

      // merge the PR if all check runs are completed and success
      const { data: { check_runs } } = await octokit.request(
        "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
        { owner, repo, ref: branch },
      );
      for (const run of check_runs) {
        const app = run.app?.slug ?? "[unknown]";

        if (run.status !== "completed") {
          console.info(
            `☕ Waiting for another check run by ${app} to be completed...`,
          );
          console.debug(run);
          return;
        }
        if (run.conclusion !== "success") {
          console.info(`❗ Another check run by ${app} is not successful`);
          console.debug(run);
          return;
        }
      }
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

export const handler = async (request: HonoRequest<"/api/github/webhooks">) => {
  await app.webhooks.verifyAndReceive({
    id: request.header("x-github-delivery")!,
    name: request.header("x-github-event") as EmitterWebhookEventName,
    payload: await request.text(),
    signature: (request.header("x-hub-signature-256")!),
  });
};
