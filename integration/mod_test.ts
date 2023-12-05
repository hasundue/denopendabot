import { retry } from "https://deno.land/std@0.208.0/async/mod.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.208.0/testing/asserts.ts";
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

await github.createBranch(baseBranch);

const main = await github.getBranch("main");
await github.updateBranch(baseBranch, main!.commit.sha);

Deno.test("integration (module)", async () => {
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

  await retry(async () =>
    assert(
      await createPullRequest(repository, options),
      "Pull request not created",
    )
  );

  await github.deleteBranch(workingBranch);
});
