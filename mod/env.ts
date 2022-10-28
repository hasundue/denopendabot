import { configSync } from "https://deno.land/std@0.161.0/dotenv/mod.ts";

type Env = {
  DENO_DEPLOYMENT_ID?: string;
  CI?: string;
  GITHUB_TOKEN?: string;
  GITHUB_OUTPUT?: string;
};

const getEnv = () => {
  if (Deno.env.get("CI") || Deno.env.get("DENO_DEPLOYMENT_ID")) {
    return Deno.env.toObject() as Env;
  } else {
    return configSync({ export: true }) as Env;
  }
};

export const env = getEnv();
