import { crypto } from "https://deno.land/std@0.164.0/crypto/mod.ts";
import { Receiver } from "https://deno.land/x/upstash_qstash@v0.2.0/pkg/receiver.ts";
import { env } from "./env.ts";

const QSTASH_URL = "https://qstash.upstash.io/v1";
const QSTASH_TOKEN = env["QSTASH_TOKEN"];

const signingKeysResponse = await fetch(QSTASH_URL + "/keys", {
  method: "GET",
  headers: {
    "authorization": "Bearer " + QSTASH_TOKEN,
  },
});

const signingKeys: {
  current: string;
  next: string;
} = await signingKeysResponse.json();

const receiver = new Receiver({
  currentSigningKey: signingKeys.current,
  nextSigningKey: signingKeys.next,
  subtleCrypto: crypto.subtle,
});

export const verifyRequest = receiver.verify;

export const publish = async (
  destination: string,
  cron: string,
  body: Record<string, unknown>,
) => {
  const response = await fetch(QSTASH_URL + "/publish/" + destination, {
    method: "POST",
    headers: {
      "authorization": "Bearer " + QSTASH_TOKEN,
      "upstash-cron": cron,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json();

  if (response.status >= 400) {
    console.error(responseBody);
    throw new Error(responseBody.error);
  }
  return responseBody;
};
