import { serve } from "https://deno.land/std@0.159.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v2.2.5/mod.ts";
import { logger } from "https://deno.land/x/hono@v2.2.5/middleware.ts";
import { getPreviewURL, handler, isPreview } from "./lib/app.ts";

const app = new Hono();

app.use("*", logger());

// transfer all requests to the test deploy
app.use("/api/github/webhooks", async (context, next) => {
  const isProduction = !(await isPreview());
  if (isProduction) {
    await fetch(await getPreviewURL(), context.req);
  }
  next();
});

app.post("/api/github/webhooks", async (context) => {
  await handler(context.req);
});

await serve(app.fetch);
