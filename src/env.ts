import { configSync } from "https://deno.land/std@0.158.0/dotenv/mod.ts";

const ENV: { DENO_DEPLOYMENT_ID?: string; CI?: string } = Deno.env.toObject();

export const env = (ENV.CI || ENV.DENO_DEPLOYMENT_ID)
  ? Deno.env.toObject()
  : configSync();
