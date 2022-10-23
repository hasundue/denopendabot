import { assert } from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "./env.ts";

Deno.test("env", () => {
  assert(env.APP_REPO.length);
  assert(env.APP_ID.length);
  assert(env.CLIENT_ID.length);
  assert(env.CLIENT_SECRET.length);
  assert(env.WEBHOOK_SECRET.length);
  assert(env.UPSTASH_REDIS_REST_URL.length);
  assert(env.UPSTASH_REDIS_REST_TOKEN.length);
});
