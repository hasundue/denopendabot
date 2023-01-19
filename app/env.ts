import { loadSync } from "https://deno.land/std@0.173.0/dotenv/mod.ts";

type Env = {
  CI?: string;
  DENO_DEPLOYMENT_ID?: string;

  GITHUB_TOKEN?: string;
  GH_TOKEN?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_REPOSITORY_OWNER?: string;
  GITHUB_REF_NAME?: string;

  APP_REPO: string;
  INSTALLATION_ID: string;

  APP_ID: string;
  PRIVATE_KEY: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  WEBHOOK_SECRET: string;
};

const getEnv = () => {
  let env: Env;

  if (Deno.env.get("CI") || Deno.env.get("DENO_DEPLOYMENT_ID")) {
    env = Deno.env.toObject() as Env;
  } else {
    env = loadSync({ export: true }) as Env;
  }
  // Do this because Deno Deploy escapes line breaks of environment variables
  env.PRIVATE_KEY = env.PRIVATE_KEY.replaceAll("\\n", "\n");

  return env;
};

export const env = getEnv();
