import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { update } from "./module.ts";

const initial = "0.158.0";
const target = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("update", async () => {
  const results = await update(
    `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `,
    [
      { url: "https://deno.land/std", target },
    ],
  );
  assertEquals(results.length, 2);
  assertEquals(
    results[0].output,
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `,
  );
  assertEquals(
    results[1].output,
    `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/assert.ts";
    `,
  );
  assertEquals(results[0].target, target);
  assertEquals(results[1].target, target);
});
