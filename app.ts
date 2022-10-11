import { serve } from "https://deno.land/std@0.158.0/http/server.ts";
import { handler, redis } from "./lib/app.ts";

try {
  const value = await Deno.readTextFile("./private-key-pkcs8.key");
  await redis.set("private_key", value);
} catch {
  // do nothing
}

await serve(handler);
