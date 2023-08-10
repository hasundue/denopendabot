import { retry } from "https://deno.land/std@0.197.0/async/mod.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.197.0/testing/asserts.ts";
import { env } from "../mod/env.ts";
import { createCommits, createPullRequest, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { ModuleUpdateSpec } from "../mod/module.ts";

const repository = "hasundue/denopendabot";
const baseBranch = "test-module";

const github = new GitHubClient({
  repository,
  token: env.GITHUB_TOKEN,
});

Deno.test("integration (module)", async () => {
  await github.deleteBranch(baseBranch);
  await github.createBranch(baseBranch);

  const workingBranch = baseBranch + "-" + env.GITHUB_REF_NAME;

  const options = {
    baseBranch,
    workingBranch,
    root: "integration/src",
    exclude: ["*.md"],
    labels: ["test"],
  };

  const updates = await retry(
    () => getUpdates(repository, options),
  );

  assertEquals(updates.length, 1);
  assertEquals(updates[0].path, "integration/src/deps.ts");

  const spec = updates[0].spec as ModuleUpdateSpec;

  assertEquals(spec, {
    name: "dax",
    url: "https://deno.land/x/dax@0.30.0/mod.ts", // @denopendabot ignore
    initial: "0.30.0",
    target: (await github.getLatestRelease("dsherret/dax"))!,
  });

  await createCommits(repository, updates, options);

  const result = await createPullRequest(repository, options);
  assert(result, "Pull request not created");

  await github.deleteBranch(workingBranch);
});
