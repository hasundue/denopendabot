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

export async function getPreviewURL() {
  const url = await redis.get<string>("preview-url");
  if (!url) throw Error("URL of preview deploy not found");
  return url;
}

export async function isPreview() {
  const id = await redis.get<string>("preview-id");
  return env["DENO_DEPLOYMENT_ID"] === id;
}

export const app = new App({
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

app.webhooks.onAny(async ({ name }) => {
  if (await isPreview()) {
    console.log("[Preview Deploy]");
  }
  console.log(`Event: ${name}`);
});

app.webhooks.on("check_suite", async ({ payload }) => {
  const repo = payload.repository.full_name;
  const branch = payload.check_suite.head_branch;

  console.log(`Repository: ${repo}@${branch}`);
});

export async function getInstallationId(repo: string): Promise<number | null> {
  let id: number | null = null;
  await app.eachInstallation(async ({ installation }) => {
    const installationId = installation.id;
    await app.eachRepository({ installationId }, ({ repository }) => {
      if (`${repository.owner.login}/${repository.name}` === repo) {
        id = installation.id;
      }
    });
  });
  return id;
}

export async function getOctokit(repo: string) {
  const id = await getInstallationId(repo);
  if (id) {
    return await app.getInstallationOctokit(id);
  } else {
    return null;
  }
}

export const handler = async (request: Request) => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!),
    payload: await request.text(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
};
