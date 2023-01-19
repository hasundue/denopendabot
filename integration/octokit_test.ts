import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { env } from "../mod/env.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { ModuleUpdate } from "../mod/module.ts";

const base = "test-octokit";

const github = new GitHubClient({
  repository: env.GITHUB_REPOSITORY,
  token: env.GITHUB_TOKEN,
});

Deno.test("getLatestRelease", async () => {
  const tag = await github.getLatestRelease();
  assert(tag);
});

Deno.test("getBranch", async () => {
  const branch = await github.getBranch("main");
  assert(branch);
  assertEquals(branch.name, "main");
});

Deno.test("getLatestCommit", async () => {
  const commit = await github.getLatestCommit();
  assert(commit);
});

Deno.test("compareBranches", async () => {
  const commits = await github.compareBranches({
    base: "main",
    head: "staging",
  });
  assert(commits);
});

Deno.test("getTree", async () => {
  const root = await github.getTree(base);
  assert(root.find((it) => it.path === "README.md"));

  const src = await github.getTree(base, "integration/src");
  assert(!src.find((it) => it.path === "README.md"));
  assert(src.find((it) => it.path === "integration/src/deps.ts"));
});

Deno.test("getTreeWithSha", async () => {
  const commit = await github.getLatestCommit(base);
  const root = await github.getTreeWithSha(commit.sha);
  assert(root.find((it) => it.path === "README.md"));

  const src = await github.getTreeWithSha(commit.sha, "integration/src");
  assert(!src.find((it) => it.path === "README.md"));
  assert(src.find((it) => it.path === "integration/src/deps.ts"));
});

Deno.test("createBranch/deleteBranch", async () => {
  const baseBranch = await github.createBranch(base);
  assertEquals(baseBranch.name, base);

  const head = base + "-" + Date.now();
  const headBranch = await github.createBranch(head, base);
  assertEquals(headBranch.name, head);

  await github.deleteBranch(head);
  const deleted = await github.getBranch(head);
  assertEquals(deleted, null);
});

Deno.test("createPullRequest", async (t) => {
  const head = base + "-" + Date.now();
  const headBranch = await github.createBranch(head, base);

  const update = new ModuleUpdate("integration/src/deps.ts", {
    name: "deno.land/x/dax",
    url: "https://deno.land/x/dax@0.24.1/mod.ts",
    initial: "0.14.0",
    target: (await github.getLatestRelease("dsherret/dax"))!,
  });
  const message = update.message();

  await t.step("createCommit", async () => {
    const result = await github.createCommit(headBranch.commit.sha, message, [
      update,
    ]);
    await github.updateBranch(head, result.sha);

    assertEquals(result.message, message);
  });

  await t.step("createPullRequest", async () => {
    const result = await github.createPullRequest({
      base,
      head,
      title: message,
    });
    assertEquals(result.title, message);
  });

  await t.step("createPullRequest (update)", async () => {
    const result = await github.createPullRequest({
      base,
      head,
      title: message,
      labels: ["test"],
    });
    assert(result.labels.find((it) => it.name === "test"));
  });

  await github.deleteBranch(head);
});
