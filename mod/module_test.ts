import { assertEquals } from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { getModuleUpdateSpecs, ModuleUpdate } from "./module.ts";
import { VERSION } from "../mod.ts";
import { env } from "./env.ts";

const initial = "0.158.0";
const target = "0.160.0"; // @denopendabot denoland/deno_std

Deno.test("getUpdateSpec/Update", async () => {
  const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/asserts.ts";
    `;

  const specs = await getModuleUpdateSpecs(input);

  assertEquals(specs.length, 2);
  assertEquals(specs[0].target, target);
  assertEquals(specs[1].target, target);

  const updates = specs.map((it) => new ModuleUpdate("deps.ts", it));

  assertEquals(updates[0].spec.name, `deno.land/std`);
  assertEquals(
    updates[0].spec.url,
    `https://deno.land/std@${initial}/testing/mod.ts`,
  );
  assertEquals(
    updates[0].content(input),
    `
    const url1 = "https://deno.land/std@${target}/testing/mod.ts";
    const url2 = "https://deno.land/std@${initial}/testing/asserts.ts";
    `,
  );
  assertEquals(updates[1].spec.name, `deno.land/std`);
  assertEquals(
    updates[1].spec.url,
    `https://deno.land/std@${initial}/testing/asserts.ts`,
  );
  assertEquals(
    updates[1].content(input),
    `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/std@${target}/testing/asserts.ts";
    `,
  );
});

Deno.test({
  name: "getUpdateSpec (release)",
  ignore: env.TEST_APP,
  fn: async () => {
    const input = `
    const url1 = "https://deno.land/std@${initial}/testing/mod.ts";
    const url2 = "https://deno.land/x/denopendabot@${VERSION}/main.ts";
    `;

    const specs = await getModuleUpdateSpecs(input, {
      name: "deno.land/x/denopendabot",
      target: "1.0.0",
    });

    assertEquals(specs.length, 1);
    assertEquals(specs[0].name, `deno.land/x/denopendabot`);
    assertEquals(specs[0].target, "1.0.0");
  },
});
