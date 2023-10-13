import { serve } from "https://deno.land/std@0.204.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v3.7.3/mod.ts";
import { getDeployEnvUrl, getThisDeployEnv } from "./app/deployments.ts";
import { handler } from "./app/webhooks.ts";

const app = new Hono();

// copy and transfer all requests to the staging deployment
app.use("*", async (context, next) => {
  if (await getThisDeployEnv() === "Production") {
    console.debug(`🏠 deployment: Production`);
    const staging = await getDeployEnvUrl("Preview");
    if (staging) {
      await fetch(staging + "/api/github/webhooks", context.req.raw.clone());
      console.debug(`✈️ transfered the request to ${staging}`);
    }
  } else {
    console.debug(`🏠 deployment: Preview`);
  }
  await next();
});

app.get("/", (context) => context.text("Hello, I'm Denopendabot!"));

// handle webhooks with octokit
app.post("/api/github/webhooks", async (context) => {
  await handler(context.req);
  return context.json(null, 200);
});

await serve(app.fetch, { onListen: () => {} });
