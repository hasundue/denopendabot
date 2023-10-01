import { loadSync } from "https://deno.land/std@0.203.0/dotenv/mod.ts";

type Env = {
  DENO_DEPLOYMENT_ID?: string;
  CI?: string;
  CI_MAIN?: string;

  GITHUB_TOKEN?: string;
  GITHUB_OUTPUT?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_REF_NAME?: string;
};

const getEnv = () => {
  if (Deno.env.get("CI") || Deno.env.get("DENO_DEPLOYMENT_ID")) {
    return Deno.env.toObject() as Env;
  } else {
    return loadSync({ export: true }) as Env;
  }
};

export const env = getEnv();
