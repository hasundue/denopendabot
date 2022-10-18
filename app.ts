import { serve } from "https://deno.land/std@0.160.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v2.2.5/mod.ts";
import { logger } from "https://deno.land/x/hono@v2.2.5/middleware.ts";
import * as app from "./lib/app.ts";

const hono = new Hono();

hono.use("*", logger());

hono.get("/", (context) => context.text("Hello, I'm Denopendabot!"));

hono.post("/api/github/webhooks", async (context) => {
  const deploy = await app.deployment();
  console.log(`deployment: ${deploy}`);

  // copy and transfer all requests to the staging deployment
  if (deploy === "production") {
    const staging = await app.location("staging");
    await fetch(staging + "api/github/webhooks", context.req.clone());
    console.log(`transfered the request to ${staging}`);
  }

  // handle the webhook with octokit
  await app.handler(context.req);

  return context.json(null, 200);
});

await serve(hono.fetch);
