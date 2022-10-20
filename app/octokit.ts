import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.0";
import { env } from "./env.ts";
import { privateKey } from "./redis.ts";
import { deployment } from "./deploy.ts";

if (!privateKey) throw Error("Private key is not deployed on Upstash Redis.");

const app = new App({
  appId: env["APP_ID"],
  privateKey,
  oauth: {
    clientId: env["CLIENT_ID"],
    clientSecret: env["CLIENT_SECRET"],
  },
  webhooks: {
    secret: env["WEBHOOK_SECRET"],
  },
});

const home = env["APP_REPO"];

export type PayLoadWithRepository = {
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

const beforeEach = (payload: PayLoadWithRepository) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  console.log(`repository: ${owner}/${repo}`);
  return { owner, repo };
};

const associated = async (
  owner: string,
  repo: string,
  branch: string | null,
) => {
  const deploy = await deployment();
  const isTest = `${owner}/${repo}` === home && branch !== null &&
    branch?.startsWith("test");
  return deploy === "staging" ? isTest : !isTest;
};

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

app.webhooks.on("check_suite.completed", async ({ octokit, payload }) => {
  const { owner, repo } = beforeEach(payload);

  const branch = payload.check_suite.head_branch;
  console.log(`branch: ${branch}`);

  // skip if the check suite is not associated with the deployment
  if (!(await associated(owner, repo, branch))) return;

  // skip if the conclusion is not success
  const conclusion = payload.check_suite.conclusion;
  if (conclusion !== "success") {
    console.log(`conclusion: ${conclusion}`);
    return;
  }
  console.log(payload);

  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    console.log(pr);
  }
});

app.webhooks.on("push", async ({ payload }) => {
  const { owner, repo } = beforeEach(payload);

  const branch = payload.ref.split("/").pop()!;
  console.log(`branch: ${branch}`);

  // skip if the push is not associated with the deployment
  if (!(await associated(owner, repo, branch))) return;

  // skip if the committer is not denopendabot
  const committer = payload.head_commit?.author.name;
  console.log(`comitter: ${committer}`);
  if (committer !== "denopendabot") return;

  console.log(payload);
});

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
