import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { createPullRequest } from "../mod.ts";
import { env } from "../lib/env.ts";
import { Client } from "../lib/github.ts";

const repo = "hasundue/denopendabot-test";
const base = "test";
const target = "0.8.0"; // @denopendabot yad/deno-udd
const github = new Client(env.GITHUB_TOKEN);

Deno.test("createPullRequest", async () => {
  const branch = "test-" + Date.now().valueOf();

  await github.createBranch(repo, base);

  const result = await createPullRequest(repo, {
    branch,
    release: target,
    include: ["deps.ts"],
  });

  assert(result);

  assertEquals(
    result.title,
    `build(deps): bump deno.land/x/udd@0.7.4/mod.ts to ${target}`,
  );

  await github.deleteBranch(repo, branch);
});
