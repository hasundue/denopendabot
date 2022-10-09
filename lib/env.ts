import "https://deno.land/std@0.159.0/dotenv/load.ts";

interface Env {
  CI?: string;
  DENO_DEPLOYMENT_ID?: string;
  GH_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

export const env: Env = Deno.env.toObject();
