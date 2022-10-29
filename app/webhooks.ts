import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.1";
import { env } from "./env.ts";
import { privateKey } from "./redis.ts";
import { Deployment, deployment } from "./deploy.ts";
import * as denopendabot from "../mod.ts";

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

type PayloadWithRepository = {
  repository: {
    owner: {
      login: string;
    };
    name: string;
    full_name: string;
  };
};

type Context = {
  deploy: Deployment;
  owner: string;
  repo: string;
};

const getContext = async (payload: PayloadWithRepository): Promise<Context> => {
  const deploy = await deployment();
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  return { deploy, owner, repo };
};

const isTestContext = (context: Context, branch: string) => {
  const { owner, repo } = context;
  return `${owner}/${repo}` === env.APP_REPO && branch.startsWith("test");
};

const associated = (context: Context, branch: string) => {
  const testing = isTestContext(context, branch);
  return context.deploy === "staging" ? testing : !testing;
};

const isDenoProject = async (
  octokit: Octokit,
  owner: string,
  repo: string,
) => {
  const { data: contents } = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    { owner, repo, path: "/" },
  );
  if (!Array.isArray(contents)) {
    console.error(contents);
    throw new Error("Project root is not a directory");
  }
  if (contents.find((it) => it.name.includes("deno.json"))) {
    return true;
  }
  return false;
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

  if (await isDenoProject(octokit, owner, repo)) {
    // create a commit
    await octokit.request(
      "PUT /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        branch: "denopendabot",
        path: ".github/workflows/denopendabot.yml",
        message: "ci: setup Denopendabot",
        committer: {
          name: "denopendabot",
          email: "denopendabot@github.com",
        },
        content: await Deno.readTextFile("./denopendabot.yml"),
      },
    );
    // get the repository info
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}",
      { owner, repo },
    );
    // create a pull request
    await octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      {
        owner,
        repo,
        title: "Setup Denopendabot",
        base: data.default_branch,
        head: "denopendabot",
        maintainer_can_modify: true,
      },
    );
    console.info(
      `🚀 Created a pull request "Setup Denopendabot" for ${owner}/${repo}`,
    );
  }
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

// run update on "denopendabot_run" repsitory-dispatch events
app.webhooks.on("repository_dispatch", async ({ octokit, payload }) => {
  console.debug(payload);

  const context = await getContext(payload);
  const inputs = payload.client_payload as ClientPayload;
  const branch = inputs.workingBranch ?? "denopendabot";
  const sender = payload.sender.login;

  if (!associated(context, branch)) return;
  if (payload.action !== "denopendabot-run") return;

  const repository = payload.repository.full_name;

  console.info(`🔥 ${sender} dispatched ${payload.action} at ${repository}`);

  const labels = inputs.labels ? inputs.labels.split(" ") : [];

  if (isTestContext(context, branch)) labels.push("test");
  if (inputs.release) labels.push("release");
  if (inputs.autoMerge) labels.push("auto-merge");

  const options: denopendabot.Options = {
    octokit,
    baseBranch: inputs.baseBranch,
    workingBranch: inputs.workingBranch,
    include: inputs.include ? inputs.include.split(" ") : undefined,
    exclude: inputs.exclude ? inputs.exclude.split(" ") : undefined,
    release: inputs.release ?? undefined,
    labels,
  };

  const updates = await denopendabot.getUpdates(repository, options);
  await denopendabot.createCommits(repository, updates, options);
  await denopendabot.createPullRequest(repository, options);
});

// merge a pull request if all checks have passed
app.webhooks.on("check_suite.completed", async ({ name, octokit, payload }) => {
  console.debug(payload);

  const context = await getContext(payload);
  const { owner, repo } = context;
  const branch = payload[name].head_branch as string;
  const app = payload[name].app.slug;

  // skip if we are not in charge of this webhook
  if (!associated(context, branch)) return;

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
    if (
      pr.user?.login === "denopendabot[bot]" &&
      pr.labels?.find((label) => label.name === "auto-merge")
    ) {
      if (!pr.mergeable) {
        console.info("☕ Pull request is not mergeable");
        continue;
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

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
