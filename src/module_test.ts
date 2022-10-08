import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { update } from "./module.ts";

const latest = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("update", async () => {
  const result = await update(
    `
    const url1 = "https://deno.land/std@0.158.0/testing/mod.ts";
    const url2 = "https://deno.land/std@0.158.0/testing/assert.ts";
    `,
    [
      { url: "https://deno.land/std", latest },
    ],
  );
  assertEquals(
    result.output,
    `
    const url1 = "https://deno.land/std@${latest}/testing/mod.ts";
    const url2 = "https://deno.land/std@${latest}/testing/assert.ts";
    `,
  );
  assertEquals(result.modules[0].latest, latest);
  assertEquals(result.modules[1].latest, latest);
});
