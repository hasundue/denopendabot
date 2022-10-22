import { configSync } from "https://deno.land/std@0.159.0/dotenv/mod.ts";

type Env = {
  GITHUB_TOKEN?: string;
  CI?: "true";
  DENO_DEPLOYMENT_ID?: string;
  TEST_APP?: boolean;
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
