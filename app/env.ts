import { loadSync } from "https://deno.land/std@0.170.0/dotenv/mod.ts";

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
  if (Deno.env.get("CI") || Deno.env.get("DENO_DEPLOYMENT_ID")) {
    return Deno.env.toObject() as Env;
  } else {
    return loadSync({ export: true }) as Env;
  }
};

export const env = getEnv();
