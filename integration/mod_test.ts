import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "../mod/env.ts";
import { createCommits, createPullRequest, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { VERSION } from "./src/version.ts";

const github = new GitHubClient(env.GITHUB_TOKEN);

const repo = "hasundue/denopendabot";
const baseBranch = "test";
const initial = VERSION;
const target = "1.0.0";

Deno.test("integration (module)", async () => {
  await github.createBranch(repo, baseBranch);

  const workingBranch = "test-module";

  const options = {
    baseBranch,
    workingBranch,
    release: target,
    include: ["integration/src/version.ts"],
    labels: ["test"],
  };

  const updates = await getUpdates(repo, options);

  assertEquals(updates.length, 1);
  assertEquals(updates[0].path, "mod/version.ts");
  assertEquals(updates[0].spec, { name: repo, initial, target });

  await createCommits(repo, updates, options);

  const result = await createPullRequest(repo, options);

  assert(result);

  assertEquals(
    result.title,
    `build(version): bump the version from ${initial} to ${target}`,
  );
});
