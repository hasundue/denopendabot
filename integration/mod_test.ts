import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "../mod/env.ts";
import { createCommits, createPullRequest, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";

const github = new GitHubClient(env.GITHUB_TOKEN);

const repo = "hasundue/denopendabot";
const baseBranch = "test";

Deno.test("integration (module)", async () => {
  await github.createBranch(repo, baseBranch);

  const workingBranch = "test-module";

  const options = {
    baseBranch,
    workingBranch,
    include: ["integration/src/deps.ts"],
    labels: ["test"],
  };

  const updates = await getUpdates(repo, options);

  assertEquals(updates.length, 1);
  assertEquals(updates[0].path, "integration/src/deps.ts");

  assertEquals(updates[0].spec, {
    name: "deno.land/x/dax",
    initial: "0.14.0",
    target: (await github.getLatestRelease("dsherret/dax"))!,
  });

  await createCommits(repo, updates, options);

  const result = await createPullRequest(repo, options);
  assert(result);
});
