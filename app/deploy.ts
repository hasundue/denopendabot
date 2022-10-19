import { env } from "./env.ts";
import { redis } from "./redis.ts";

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
