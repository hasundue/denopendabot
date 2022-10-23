if (!Deno.env.get("CI") && !Deno.env.get("DENO_DEPLOYMENT_ID")) {
  await import("https://deno.land/std@0.160.0/dotenv/load.ts");
}

export const env = {
  get: Deno.env.get,
};
