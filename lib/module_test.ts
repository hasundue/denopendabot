import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { checkUpdate, getContent } from "./module.ts";

const initial = "0.158.0";
const target = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("check/content", async () => {
  const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `;

  const updates = await checkUpdate(input);

  assertEquals(updates.length, 2);
  assertEquals(updates[0].target, target);
  assertEquals(updates[1].target, target);

  const contents = await Promise.all(
    updates.map((it) => getContent(input, it)),
  );

  assertEquals(
    contents[0],
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `,
  );
  assertEquals(
    contents[1],
    `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/assert.ts";
    `,
  );
});
