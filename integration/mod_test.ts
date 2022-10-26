import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "../mod/env.ts";
import { createCommits, createPullRequest, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const initial = "0.7.1"; // @denopendabot hasundue/denopendabot
const target = "1.0.0";

const github = new GitHubClient(env["GITHUB_TOKEN"]);

Deno.test("integration (module)", async () => {
  await github.createBranch(repo, base);

  const branch = "test-module";

  const options = {
    base,
    branch,
    release: target,
    include: ["mod/version.ts"],
    test: true,
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
