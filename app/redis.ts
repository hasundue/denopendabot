import { Redis } from "https://deno.land/x/upstash_redis@v1.16.1/mod.ts";
import { env } from "./env.ts";

export const redis = new Redis({
  url: env["UPSTASH_REDIS_REST_URL"],
  token: env["UPSTASH_REDIS_REST_TOKEN"],
});

export async function uploadPrivateKey(path: string) {
  try {
    const value = await Deno.readTextFile(path);
    await redis.set("private_key", value);
  } catch {
    // do nothing
  }
}

export const privateKey = await redis.get<string>("private_key");
