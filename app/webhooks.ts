import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.0";
import { env } from "../env.ts";
import { privateKey } from "./redis.ts";
import { Deployment, deployment } from "./deploy.ts";

if (!privateKey) throw Error("Private key is not deployed on Upstash Redis.");

const app = new App({
  appId: env.get("APP_ID")!,
  privateKey,
  oauth: {
    clientId: env.get("CLIENT_ID")!,
    clientSecret: env.get("CLIENT_SECRET")!,
  },
  webhooks: {
    secret: env.get("WEBHOOK_SECRET")!,
  },
});

const home = env.get("APP_REPO")!;

type PayLoadWithRepositoryAndHeadBranch = {
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
  branch: string;
};

const getContext = async (
  name: string,
  payload: PayLoadWithRepositoryAndHeadBranch,
) => {
  const deploy = await deployment();
  console.log(`deployment: ${deploy}`);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  console.log(`repository: ${owner}/${repo}`);

  // @ts-ignore an event object always has the head_branch field in our cases
  const branch = payload[name].head_branch as string;
  console.log(`branch: ${branch}`);

  return { deploy, owner, repo, branch };
};

const associated = (context: Context) => {
  const { deploy, owner, repo, branch } = context;
  const isTest = `${owner}/${repo}` === home && branch === "test-app";
  return deploy === "staging" ? isTest : repo === "denopendabot";
};

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

app.webhooks.on("check_suite.completed", async ({ name, octokit, payload }) => {
  const context = await getContext(name, payload);
  const { owner, repo } = context;

  // skip if the check suite is not associated with the deployment
  if (!associated(context)) return;

  // skip if the conclusion is not success
  const conclusion = payload.check_suite.conclusion;
  if (conclusion !== "success") {
    console.log(`conclusion: ${conclusion}`);
    return;
  }
  console.log(payload);

  // merge pull requests if the status is success
  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    if (pr.user?.login === "denopendabot[bot]") {
      console.log(pr);
      const { data: result } = await octokit.request(
        "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
        { owner, repo, pull_number: number },
      );
      if (result.merged) {
        console.log(`🎉 Merged a pull request "${pr.title}"`);
      } else {
        console.warn(`❗ ${result.message}`);
      }
    }
  }
});

app.webhooks.on(
  "workflow_run.completed",
  async ({ name, payload }) => {
    const context = await getContext(name, payload);

    console.log(payload);

    // skip if the check suite is not associated with the deployment
    if (!associated(context)) return;
  },
);

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
