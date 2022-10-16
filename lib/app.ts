import { Redis } from "https://deno.land/x/upstash_redis@v1.15.0/mod.ts";
import { App } from "https://esm.sh/@octokit/app@13.0.11";
import { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.0";
import { env } from "./env.ts";

export const redis = new Redis({
  url: env["UPSTASH_REDIS_REST_URL"],
  token: env["UPSTASH_REDIS_REST_TOKEN"],
});

const privateKey = await redis.get<string>("private_key");
if (!privateKey) throw Error("Private key is not deployed on Upstash Redis.");

export async function uploadPrivateKey(path: string) {
  try {
    const value = await Deno.readTextFile(path);
    await redis.set("private_key", value);
  } catch {
    // do nothing
  }
}

export type Deployment = "production" | "staging" | "preview";

export const deployment = async (): Promise<Deployment> => {
  const id = env["DENO_DEPLOYMENT_ID"];
  if (id === await redis.get<string>("production-id")) {
    return "production";
  } else if (id === await redis.get<string>("staging-id")) {
    return "staging";
  } else {
    return "preview";
  }
};

export const location = async (deploy: "production" | "staging") => {
  const url = await redis.get<string>(`${deploy}-url`);
  if (!url) {
    throw Error(`key ${deploy}-id is not found on Upstash`);
  }
  return url;
};

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

type PayLoadWithRepository = {
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

const beforeEach = async (
  payload: PayLoadWithRepository,
  branch: string | null,
) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const repository = `${owner}/${repo}`;

  console.log(`repository: ${repository}`);
  console.log(`branch: ${branch}`);
  console.log(payload);

  const deploy = await deployment();
  const isTest = branch !== null && repository === home &&
    branch.startsWith("test");
  const relevant = deploy === "staging" ? isTest : !isTest;

  return { owner, repo, relevant };
};

app.webhooks.onAny(({ name }) => {
  console.log(`event: ${name}`);
});

app.webhooks.on("check_suite.completed", async ({ octokit, payload }) => {
  const branch = payload.check_suite.head_branch;
  const { owner, repo, relevant } = await beforeEach(payload, branch);

  if (!relevant || payload.check_suite.conclusion !== "success") return;

  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    console.log(pr);
  }
});

app.webhooks.on;

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
