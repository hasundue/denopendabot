import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import * as github from "./github.ts";

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

Deno.test("createBranch", async () => {
  const name = "test-" + Date.now().valueOf();

  const exists = await github.getBranch(repo, name);
  if (exists) await github.deleteBranch(repo, name);

  assertEquals(await github.getBranch(repo, name), null);

  await github.createBranch(repo, name);
  const branch = await github.getBranch(repo, name);

  assert(branch);
  assertEquals(branch.name, name);

  await github.deleteBranch(repo, name);

  assertEquals(await github.getBranch(repo, name), null);
});

Deno.test("createCommit", async () => {
  const branch = "test-" + Date.now().valueOf();
  const url = "https://deno.land/std@0.158.0";
  const target = "0.159.0";

  assertEquals(await github.getBranch(repo, branch), null);
  await github.createBranch(repo, branch);

  await github.createCommit(repo, branch, [
    {
      path: "test.ts",
      url,
      target,
      output: "https://deno.land/std@0.159.0",
    },
  ]);

  const { commit } = await github.getCommit(repo, branch);
  assertEquals(commit.message, `build(deps): bump ${url} to ${target}`);

  await github.deleteBranch(repo, branch);
  assertEquals(await github.getBranch(repo, branch), null);
});
