import { configSync } from "https://deno.land/std@0.160.0/dotenv/mod.ts";

type Env = {
  CI?: string;
  GITHUB_TOKEN?: string;
};

const getEnv = () => {
  if (Deno.env.get("CI")) {
    return Deno.env.toObject() as Env;
  } else {
    return configSync({ export: true }) as Env;
  }
};

export const env = getEnv();
