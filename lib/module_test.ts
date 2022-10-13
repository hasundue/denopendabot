import { assertEquals } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import {
  getUpdateSpecs,
  removeIgnore,
  removeLineToIgnore,
  removeMarkdownIgnoreSection,
  Update,
} from "./module.ts";

const initial = "0.158.0";
const target = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("removeLineToIgnore", () => {
  const input = `
    Do not ignore this
    Ignore this // @denopendabot ignore
    Do not ignore this`;

  const output = removeLineToIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});

Deno.test("removeIgnoreMarkdownSection", () => {
  const input = `
    Do not ignore this
    <!-- denopendabot-ignore-start -->
    Ignore this
    <!-- denopendabot-ignore-end -->
    Do not ignore this`;

  const output = removeMarkdownIgnoreSection(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});

Deno.test("removeIgnore", () => {
  const input = `
    Do not ignore this
    <!-- denopendabot-ignore-start -->
    Ignore this
    <!-- denopendabot-ignore-end -->
    Do not ignore this`;

  const output = removeIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});

Deno.test("getUpdateSpec/Update", async () => {
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
