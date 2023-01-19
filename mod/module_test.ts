import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { getModuleUpdateSpecs, ModuleUpdate } from "./module.ts";
import { VERSION } from "./version.ts";
import { GitHubClient } from "./octokit.ts";
import { env } from "./env.ts";

const github = new GitHubClient({ token: env.GITHUB_TOKEN });

const latest = {
  flat: await github.getLatestRelease("githubocto/flat-postprocessing"),
  lambda: await github.getLatestRelease("hayd/deno-lambda"),
  express: await github.getLatestRelease("expressjs/express"),
  octokit: await github.getLatestRelease("octokit/core.js"),
};

// @denopendabot ignore-start

Deno.test("deno.land", async () => {
  const input = `
    import { readJSON } from "https://deno.land/x/flat@0.0.14/mod.ts";
    import { Context } from "https://deno.land/x/lambda@1.26.0/mod.ts";
    `;

  const specs = await getModuleUpdateSpecs(input);

  assertEquals(specs.length, 2);
  assertEquals(specs[0].target, latest.flat);
  assertEquals(specs[1].target, latest.lambda);

  const updates = specs.map((it) => new ModuleUpdate("deps.ts", it));

  assertEquals(updates[0].spec.name, "flat");
  assertEquals(
    updates[0].spec.url,
    "https://deno.land/x/flat@0.0.14/mod.ts",
  );
  assertEquals(
    updates[0].content(input),
    `
    import { readJSON } from "https://deno.land/x/flat@${latest.flat}/mod.ts";
    import { Context } from "https://deno.land/x/lambda@1.26.0/mod.ts";
    `,
  );
  assertEquals(updates[1].spec.name, "lambda");
  assertEquals(
    updates[1].spec.url,
    "https://deno.land/x/lambda@1.26.0/mod.ts",
  );
  assertEquals(
    updates[1].content(input),
    `
    import { readJSON } from "https://deno.land/x/flat@0.0.14/mod.ts";
    import { Context } from "https://deno.land/x/lambda@${latest.lambda}/mod.ts";
    `,
  );
});

Deno.test("release", async () => {
  const input = `
    const url1 = "https://deno.land/std@0.158.0/testing/mod.ts";
    const url2 = "https://deno.land/x/denopendabot@${VERSION}/cli.ts";
    `;

  const specs = await getModuleUpdateSpecs(input, {
    name: "denopendabot",
    target: "1.0.0",
  });

  assertEquals(specs.length, 1);
  assertEquals(specs[0].name, "denopendabot");
  assertEquals(specs[0].target, "1.0.0");
});

Deno.test("npm", async () => {
  const input = `
    import express from "npm:express@3.5.3";
    `;

  const specs = await getModuleUpdateSpecs(input);

  assertEquals(specs.length, 1);
  assertEquals(specs[0].target, latest.express);

  const updates = specs.map((it) => new ModuleUpdate("deps.ts", it));

  assertEquals(updates[0].spec.name, "express");
  assertEquals(
    updates[0].spec.url,
    `npm:express@3.5.3`,
  );
  assertEquals(
    updates[0].content(input),
    `
    import express from "npm:express@${latest.express}";
    `,
  );
});

Deno.test("esm.sh", async () => {
  const latestRelease = latest.octokit?.slice(1);

  const input = `
    import { Octokit } from "https://esm.sh/@octokit/core@4.0.0";
    `;
  const specs = await getModuleUpdateSpecs(input);

  assertEquals(specs.length, 1);
  assertEquals(specs[0].target, latestRelease);

  const updates = specs.map((it) => new ModuleUpdate("deps.ts", it));

  assertEquals(updates[0].spec.name, "@octokit/core");
  assertEquals(
    updates[0].spec.url,
    `https://esm.sh/@octokit/core@4.0.0`,
  );
  assertEquals(
    updates[0].content(input),
    `
    import { Octokit } from "https://esm.sh/@octokit/core@${latestRelease}";
    `,
  );
});

// @denopendabot ignore-end
