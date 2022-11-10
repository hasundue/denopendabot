import { assertEquals } from "https://deno.land/std@0.162.0/testing/asserts.ts";
import { getModuleUpdateSpecs, ModuleUpdate } from "./module.ts";
import { VERSION } from "./version.ts";
import { GitHubClient } from "./octokit.ts";

const github = new GitHubClient();

const latest = {
  flat: await github.getLatestRelease("githubocto/flat-postprocessing"),
  lambda: await github.getLatestRelease("hayd/deno-lambda"),
};

// @denopendabot ignore-start

Deno.test("getUpdateSpec/Update", async () => {
  const input = `
    import { readJSON } from "https://deno.land/x/flat@0.0.14/mod.ts";
    import { Context } from "https://deno.land/x/lambda@1.26.0/mod.ts";
    `;

  const specs = await getModuleUpdateSpecs(input);

  assertEquals(specs.length, 2);
  assertEquals(specs[0].target, latest.flat);
  assertEquals(specs[1].target, latest.lambda);

  const updates = specs.map((it) => new ModuleUpdate("deps.ts", it));

  assertEquals(updates[0].spec.name, `deno.land/x/flat`);
  assertEquals(
    updates[0].spec.url,
    `https://deno.land/x/flat@0.0.14/mod.ts`,
  );
  assertEquals(
    updates[0].content(input),
    `
    import { readJSON } from "https://deno.land/x/flat@${latest.flat}/mod.ts";
    import { Context } from "https://deno.land/x/lambda@1.26.0/mod.ts";
    `,
  );
  assertEquals(updates[1].spec.name, `deno.land/x/lambda`);
  assertEquals(
    updates[1].spec.url,
    `https://deno.land/x/lambda@1.26.0/mod.ts`,
  );
  assertEquals(
    updates[1].content(input),
    `
    import { readJSON } from "https://deno.land/x/flat@0.0.14/mod.ts";
    import { Context } from "https://deno.land/x/lambda@${latest.lambda}/mod.ts";
    `,
  );
});

Deno.test("getUpdateSpec (release)", async () => {
  const input = `
    const url1 = "https://deno.land/std@0.158.0/testing/mod.ts";
    const url2 = "https://deno.land/x/denopendabot@${VERSION}/cli.ts";
    `;

  const specs = await getModuleUpdateSpecs(input, {
    name: "deno.land/x/denopendabot",
    target: "1.0.0",
  });

  assertEquals(specs.length, 1);
  assertEquals(specs[0].name, `deno.land/x/denopendabot`);
  assertEquals(specs[0].target, "1.0.0");
});

// @denopendabot ignore-end
