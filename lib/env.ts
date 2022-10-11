import "https://deno.land/std@0.159.0/dotenv/load.ts";

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

export const env: Env = Deno.env.toObject() as Env;
