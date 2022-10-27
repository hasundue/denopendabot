import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.1";
import { env } from "./env.ts";
import { privateKey } from "./redis.ts";
import { Deployment, deployment } from "./deploy.ts";
import * as denopendabot from "../mod.ts";

type PayLoadWithRepository = {
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

type Context = {
  deploy: Deployment;
  owner: string;
  repo: string;
};

type ClientPayloadKeys =
  | "mode"
  | "token"
  | "user-token"
  | "repository"
  | "base-branch"
  | "working-branch"
  | "auto-merge"
  | "release";

type ClientPayload = Partial<
  {
    [K in ClientPayloadKeys]: string;
  }
>;

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

const getContext = async (payload: PayLoadWithRepository) => {
  const deploy = await deployment();
  console.log(`deployment: ${deploy}`);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  console.info(`repository: ${owner}/${repo}`);

  return { deploy, owner, repo };
};

const isTest = (context: Context, branch: string) => {
  const { owner, repo } = context;
  return `${owner}/${repo}` === env.APP_REPO && branch === "test-app";
};

const associated = (context: Context, branch: string) =>
  context.deploy === "staging"
    ? isTest(context, branch)
    : branch === "denopendabot";

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

// run update
app.webhooks.on("repository_dispatch", async ({ octokit, payload }) => {
  if (payload.action !== "denopendabot-run") return;

  const context = await getContext(payload);
  const inputs: ClientPayload = payload.client_payload;
  const branch = inputs["working-branch"] ?? "denopendabot";
  console.log(`branch: ${branch}`);

  if (!associated(context, branch)) return;

  console.debug(payload);

  const repository = payload.repository.full_name;

  const labels = ["dependencies"];
  if (isTest(context, branch)) {
    labels.push("test");
  }
  if (inputs["auto-merge"] === "all") {
    labels.push("auto-merge");
  }

  const options: denopendabot.Options = {
    octokit,
    baseBranch: inputs["base-branch"],
    workingBranch: inputs["working-branch"],
    ...inputs,
  };

  const updates = await denopendabot.getUpdates(repository, options);
  await denopendabot.createCommits(repository, updates, options);
  await denopendabot.createPullRequest(repository, { ...options, labels });
});

// merge a pull request if the check has passed
app.webhooks.on("check_suite.completed", async ({ name, octokit, payload }) => {
  const context = await getContext(payload);
  const { owner, repo } = context;

  // @ts-ignore an event object always has the head_branch field in our cases
  const branch = payload[name].head_branch as string;
  console.log(`branch: ${branch}`);

  // skip if the check suite is not associated with the deployment
  if (!associated(context, branch)) return;

  // skip if the conclusion is not success
  const conclusion = payload.check_suite.conclusion;
  if (conclusion !== "success") {
    console.log(`conclusion: ${conclusion}`);
    return;
  }
  console.debug(payload);

  // merge pull requests if the status is success
  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    if (
      pr.user?.login === "denopendabot[bot]" &&
      pr.labels?.find((label) => label.name === "auto-merge")
    ) {
      console.log(pr);
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
