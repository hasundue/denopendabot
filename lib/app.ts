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

export type Deployment = "production" | "staging";

export const deployment = async (): Promise<Deployment> => {
  const id = env["DENO_DEPLOYMENT_ID"];
  const staging = await redis.get<string>("staging-id");
  return id === staging ? "staging" : "production";
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

const beforeEach = (payload: PayLoadWithRepository) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  console.log(`repository: ${owner}/${repo}`);
  return { owner, repo };
};

const isRelevant = async (
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
  if (payload.check_suite.conclusion !== "success") return;

  const branch = payload.check_suite.head_branch;
  console.log(`branch: ${branch}`);

  if (!isRelevant(owner, repo, branch)) return;

  console.log(payload);

  for (const { number } of payload.check_suite.pull_requests) {
    const { data: pr } = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number },
    );
    console.log(pr);
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
