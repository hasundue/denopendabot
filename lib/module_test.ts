import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { getUpdateSpecs, Update } from "./module.ts";

const initial = "0.158.0";
const target = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("check/content", async () => {
  const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `;

  const specs = await getUpdateSpecs(input);

  assertEquals(specs.length, 2);
  assertEquals(specs[0].target, target);
  assertEquals(specs[1].target, target);

  const updates = specs.map((it) => new Update("deps.ts", it));

  assertEquals(
    updates[0].content(input),
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/assert.ts";
    `,
  );
  assertEquals(
    updates[1].content(input),
    `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/assert.ts";
    `,
  );
});
