import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import * as github from "./github.ts";
import { Update } from "./repo.ts";
import { VERSION } from "../mod.ts";

const repo = "hasundue/denopendabot";

Deno.test("getLatestRelease", async () => {
  const tag = await github.getLatestRelease(repo);
  assert(tag);
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

Deno.test("createPullRequest", async (t) => {
  const branch = "test-" + Date.now().valueOf();

  await t.step("createBranch", async () => {
    await github.createBranch(repo, branch);
  });

  const update = new Update("mod.ts", {
    name: "hasundue/denopendabot",
    initial: VERSION,
    target: "1.0.0",
  });
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

  await t.step("deleteBranch", async () => {
    await github.deleteBranch(repo, branch);
  });
});
