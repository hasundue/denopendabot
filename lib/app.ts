import { Redis } from "https://deno.land/x/upstash_redis@v1.15.0/mod.ts";
import { App } from "https://esm.sh/@octokit/app@13.0.11";
import { EmitterWebhookEventName } from "https://esm.sh/@octokit/webhooks@10.3.0";
import { env } from "./env.ts";

export const redis = new Redis({
  url: env["UPSTASH_REDIS_REST_URL"],
  token: env["UPSTASH_REDIS_REST_TOKEN"],
});

const privateKey: string | null = await redis.get("private_key");

if (!privateKey) throw Error("Private key is not deployed on Upstash Redis.");

export async function uploadPrivateKey(path: string) {
  try {
    const value = await Deno.readTextFile(path);
    await redis.set("private_key", value);
  } catch {
    // do nothing
  }
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

app.webhooks.on("check_run.completed", ({ payload }) => {
  console.log(payload);
});

export const handler = async (request: Request): Promise<Response> => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery")!,
    signature: (request.headers.get("x-hub-signature-256")!)
      .replace(/sha256=/, ""),
    payload: await request.json(),
    name: request.headers.get("x-github-event") as EmitterWebhookEventName,
  });
  return new Response(null, { status: 200 });
};
