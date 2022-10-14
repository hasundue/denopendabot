import { assertEquals } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { getUpdateSpecs, Update } from "./module.ts";
import { VERSION } from "../mod.ts";

const initial = "0.158.0";
const target = "0.159.0"; // @denopendabot denoland/deno_std

Deno.test("getUpdateSpec/Update", async () => {
  const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/asserts.ts";
    `;

  const specs = await getUpdateSpecs(input);

  assertEquals(specs.length, 2);
  assertEquals(specs[0].target, target);
  assertEquals(specs[1].target, target);

  const updates = specs.map((it) => new Update("deps.ts", it));

  assertEquals(
    updates[0].spec.name,
    `deno.land/std@${initial}`,
  );
  assertEquals(
    updates[0].content(input),
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/asserts.ts";
    `,
  );
  assertEquals(
    updates[1].spec.name,
    `deno.land/std@${initial}`,
  );
  assertEquals(
    updates[1].content(input),
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/asserts.ts";
    `,
  );
});

Deno.test("getUpdateSpec (release)", async () => {
  const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/x/denopendabot@${VERSION}/main.ts";
    `;

  const specs = await getUpdateSpecs(input, {
    name: "deno.land/x/denopendabot",
    target: "1.0.0",
  });

  assertEquals(specs.length, 2);
  assertEquals(specs[0].name, `deno.land/std@${initial}`);
  assertEquals(specs[0].target, target);
  assertEquals(specs[1].name, `deno.land/x/denopendabot@${VERSION}`);
  assertEquals(specs[1].target, "1.0.0");
});
