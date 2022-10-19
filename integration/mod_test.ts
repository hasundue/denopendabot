import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { createPullRequest } from "../mod.ts";
import { env } from "../mod/env.ts";
import { Client } from "../mod/github.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const initial = "0.6.2"; // @denopendabot hasundue/denopendabot
const target = "1.0.0";
const github = new Client(env.GITHUB_TOKEN);

Deno.test("createPullRequest", async () => {
  const branch = "test-module";

  await github.createBranch(repo, base);

  const result = await createPullRequest(repo, {
    base,
    branch,
    release: target,
    include: ["mod.ts"],
    test: true,
  });

  assert(result);

  assertEquals(
    result.title,
    `[TEST] build(version): bump the version from ${initial} to ${target}`,
  );
});
