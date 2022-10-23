import { App } from "https://esm.sh/@octokit/app@13.0.11";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
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

export async function getAppOctokit(
  repo: string,
) {
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
}

const home = env.get("APP_REPO")!;

export type PayLoadWithRepository = {
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

const getContext = async (payload: PayLoadWithRepository) => {
  const deploy = await deployment();
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const repository = `${owner}/${repo}`;
  console.log(`repository: ${repository}`);
  return { deploy, repository, owner, repo };
};

const associated = (
  deploy: Deployment,
  owner: string,
  repo: string,
  branch: string | null,
) => {
  const isTest = `${owner}/${repo}` === home && branch !== null &&
    branch === "test-app";
  return deploy === "staging" ? isTest : repo === "denopendabot";
};

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

app.webhooks.on("check_suite.completed", async ({ octokit, payload }) => {
  const { deploy, owner, repo } = await getContext(payload);

  const branch = payload.check_suite.head_branch;
  console.log(`branch: ${branch}`);

  // skip if the check suite is not associated with the deployment
  if (!associated(deploy, owner, repo, branch)) return;

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
