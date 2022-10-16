import { serve } from "https://deno.land/std@0.159.0/http/server.ts";
import { Hono } from "https://deno.land/x/hono@v2.2.5/mod.ts";
import { logger } from "https://deno.land/x/hono@v2.2.5/middleware.ts";
import { getPreviewURL, handler, isPreview } from "./lib/app.ts";

const app = new Hono();

app.use("*", logger());

app.get("/", (context) => context.text("Hello, I'm Denopendabot!"));

app.post("/api/github/webhooks", async (context) => {
  // transfer all requests to the test deploy
  const isProduction = !(await isPreview());
  if (isProduction) {
    const previewURL = await getPreviewURL();
    await fetch(previewURL + "api/github/webhooks", context.req);
  }
  await handler(context.req);
});

await serve(app.fetch);
