import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { App } from "https://esm.sh/@octokit/app@13.0.11";
import type { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.0";
import { env } from "../env.ts";
import { privateKey } from "./redis.ts";
import { Deployment, deployment } from "./deploy.ts";
import {
  createCommits,
  createPullRequest,
  getUpdates,
  Options,
} from "../mod.ts";

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

const APP_REPO = env.get("APP_REPO");

if (!privateKey) {
  throw Error("Private key is not deployed on Upstash Redis.");
}

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

const getContext = async (payload: PayLoadWithRepository) => {
  const deploy = await deployment();
  console.log(`deployment: ${deploy}`);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  console.log(`repository: ${owner}/${repo}`);

  return { deploy, owner, repo };
};

const associated = (context: Context, branch: string) => {
  const { deploy, owner, repo } = context;
  const isTest = `${owner}/${repo}` === APP_REPO && branch === "test-app";
  return deploy === "staging" ? isTest : branch === "denopendabot";
};

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

// run update
app.webhooks.on("repository_dispatch", async ({ octokit, payload }) => {
  if (payload.action !== "denopendabot-run") return;

  const context = await getContext(payload);
  const options: Options = payload.client_payload;

  if (!associated(context, options?.branch ?? "denopendabot")) return;

  console.log(payload);

  const repository = payload.repository.full_name;

  const updates = await getUpdates(repository, { ...options, octokit });
  await createCommits(repository, updates, { ...options, octokit });
  await createPullRequest(repository, { ...options, octokit });
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

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};

export const getAppOctokit = async (
  repo: string,
) => {
  try {
    await app.eachRepository(({ repository, octokit }) => {
      if (repository.full_name === repo) {
        throw octokit;
      }
    });
  } catch (exception) {
    if (exception instanceof Octokit) {
      return exception;
    } else {
      throw exception;
    }
  }
  return null;
};
