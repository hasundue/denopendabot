import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import * as github from "./github.ts";
import { Update } from "./module.ts";

const repo = "hasundue/denopendabot-test";

Deno.test("getLatestRelease", async () => {
  const tag = await github.getLatestRelease(repo);
  assert(!tag);
});

Deno.test("getBranch", async () => {
  const branch = await github.getBranch(repo, "main");
  assert(branch);
  assertEquals(branch.name, "main");
});

Deno.test("getCommit", async () => {
  const commit = await github.getCommit(repo, "main");
  assert(commit);
});

Deno.test("createBranch/deleteBranch", async () => {
  const name = "test-" + Date.now().valueOf();

  await github.createBranch(repo, name);
  const branch = await github.getBranch(repo, name);

  assert(branch);
  assertEquals(branch.name, name);

  await github.deleteBranch(repo, name);

  assertEquals(await github.getBranch(repo, name), null);
});

Deno.test("createPullRequest", async (t) => {
  const dep = "https://deno.land/std@0.158.0";

  const branch = "test-" + Date.now().valueOf();
  await github.createBranch(repo, branch);

  const target = "0.159.0";
  const content =
    `import { assert } from "https://deno.land/std@0.159.0/testing/mod.ts";`;
  const spec = { dep, target, content };
  const update = new Update("deps.ts", spec);
  const message = update.message();

  await t.step("createCommit", async () => {
    const result = await github.createCommit(repo, branch, message, [update]);
    assertEquals(result.message, message);
  });

  await t.step("createPullRequest", async () => {
    await github.createPullRequest(repo, branch, message);
    const prs = await github.getPullRequests(repo);
    assertEquals(prs[0].title, message);
  });

  await t.step("updateBranch", async () => {
    // reset to the head of main
    await github.updateBranch(repo, branch);

    const main = await github.getCommit(repo);
    const current = await github.getCommit(repo, branch);

    assertEquals(main.sha, current.sha);
  });

  await github.deleteBranch(repo, branch);
});
