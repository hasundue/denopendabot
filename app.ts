import * as dotenv from "https://deno.land/std@0.158.0/dotenv/mod.ts";
import { Redis } from "https://deno.land/x/upstash_redis@v1.13.1/mod.ts";
import * as Octokit from "https://esm.sh/octokit@2.0.7";
import { serve } from "https://deno.land/std@0.158.0/http/server.ts";

const env = Deno.env.get("DENO_DEPLOYMENT_ID")
  ? Deno.env.toObject()
  : dotenv.configSync();

const redis = new Redis({
  url: env["UPSTASH_REDIS_REST_URL"],
  token: env["UPSTASH_REDIS_REST_TOKEN"],
});

const privateKey: string | null = await redis.get("private_key");

if (!privateKey) throw Error("Private key is not deployed on Upstash Redis.");

const app = new Octokit.App({
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

app.webhooks.onAny(({ name }) => {
  console.log(name, "event received");
});

const handler = async (request: Request): Promise<Response> => {
  await app.webhooks.verifyAndReceive({
    id: request.headers.get("x-github-delivery") as string,
    name: request.headers.get("x-github-event"),
    signature: request.headers.get("x-hub-signature-256") as string,
    payload: await request.json(),
  });
  return new Response();
};

await serve(handler, { port: 3000 });
