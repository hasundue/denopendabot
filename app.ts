import { serve } from "https://deno.land/std@0.160.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v2.2.5/mod.ts";
import { logger } from "https://deno.land/x/hono@v2.3.2/middleware.ts";
import { deployment, location } from "./app/deploy.ts";
import { handler } from "./app/webhooks.ts";
import { verifyRequest } from "./app/qstash.ts";

const app = new Hono();

app.use("*", logger());

// copy and transfer all requests to the staging deployment
app.use("*", async (context, next) => {
  const deploy = await deployment();
  if (deploy === "production") {
    const staging = await location("staging");
    await fetch(staging + "api/github/webhooks", context.req.clone());
    console.log(`transfered the request to ${staging}`);
  }
  await next();
});

app.get("/", (context) => context.text("Hello, I'm Denopendabot!"));

// handle webhooks with octokit
app.post("/api/github/webhooks", async (context) => {
  await handler(context.req);
  return context.json(null, 200);
});

// verify requests from qstash
app.use("/api/qstash/*", async (c, next) => {
  const valid = await verifyRequest({
    signature: c.req.header("upstash-signature"),
    body: await c.req.text(),
  });
  if (!valid) {
    throw new Error("Signature is invalid");
  }
  await next();
});

await serve(app.fetch);
