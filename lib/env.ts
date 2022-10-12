import { configSync } from "https://deno.land/std@0.159.0/dotenv/mod.ts";

type Env = {
  CI?: string;
  DENO_DEPLOYMENT_ID?: string;

  GH_TOKEN?: string;
  GITHUB_TOKEN?: string;

  APP_ID: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  WEBHOOK_SECRET: string;

  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
};

const ENV = Deno.env.toObject();

function getEnv() {
  if (ENV["CI"] || ENV["DENO_DEPLOYMENT_ID"]) {
    return ENV;
  } else {
    return configSync();
  }
}

export const env = getEnv() as Env;
