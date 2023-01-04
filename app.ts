import { serve } from "https://deno.land/std@0.170.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v2.7.0/mod.ts";
import { deployment, location } from "./app/deployments.ts";
import { handler } from "./app/webhooks.ts";

const app = new Hono();

console.debug(app);

// copy and transfer all requests to the staging deployment
app.use("*", async (context, next) => {
  const deploy = await deployment();
  console.debug(`🏠 deployment: ${deploy}`);

  if (deploy === "production") {
    const staging = await location("staging");
    await fetch(staging + "api/github/webhooks", context.req.clone());
    console.debug(`✈️ transfered the request to ${staging}`);
  }
  await next();
});

console.debug(app);

app.get("/", (context) => context.text("Hello, I'm Denopendabot!"));

console.debug(app);

// handle webhooks with octokit
app.post("/api/github/webhooks", async (context) => {
  await handler(context.req);
  return context.json(null, 200);
});

console.debug(app);

await serve(app.fetch, { onListen: () => {} });
