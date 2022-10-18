import { configSync } from "https://deno.land/std@0.160.0/dotenv/mod.ts";

type Env = {
  CI?: string;
  GITHUB_TOKEN?: string;

  DENO_DEPLOYMENT_ID?: string;

  APP_REPO: string;
  APP_ID: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  WEBHOOK_SECRET: string;

  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

type EnvKey = keyof Env;

const getEnv = () => {
  if (Deno.env.get("CI") || Deno.env.get("DENO_DEPLOYMENT_ID")) {
    return Deno.env.toObject() as Env;
  } else {
    return configSync() as Env;
  }
};

const ENV = getEnv();

export const env = {
  ...ENV,
  get: (key: string) => ENV[key as EnvKey],
};
