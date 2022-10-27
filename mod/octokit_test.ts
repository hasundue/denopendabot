import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.161.0/testing/asserts.ts";
import { env } from "./env.ts";
import { GitHubClient } from "./octokit.ts";
import { VERSION } from "./version.ts";
import { RepoUpdate } from "./repo.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-octokit";
const github = new GitHubClient(env.GITHUB_TOKEN);

Deno.test("getLatestRelease", async () => {
  const tag = await github.getLatestRelease(repo);
  assert(tag);
});

Deno.test("getBranch", async () => {
  const branch = await github.getBranch(repo, "main");
  assert(branch);
  assertEquals(branch.name, "main");
});

Deno.test("getLatestCommit", async () => {
  const commit = await github.getLatestCommit(repo, "main");
  assert(commit);
});

Deno.test("compareBranches", async () => {
  const commits = await github.compareBranches(repo, "main", "test");
  assert(commits);
});

Deno.test("createBranch/deleteBranch", { ignore: !env.CI }, async () => {
  const baseBranch = await github.createBranch(repo, base);
  assertEquals(baseBranch.name, base);

  const testBranchName = "test-" + Date.now();
  const testBranch = await github.createBranch(repo, testBranchName);
  assertEquals(testBranch.name, testBranchName);

  await github.deleteBranch(repo, testBranchName);
  const deleted = await github.getBranch(repo, testBranchName);
  assertEquals(deleted, null);
});

Deno.test("createPullRequest", { ignore: !env.CI }, async (t) => {
  await github.createBranch(repo, branch, base);

  const update = new RepoUpdate("mod/version.ts", {
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
    const result = await github.createPullRequest(
      repo,
      base,
      branch,
      message,
      ["test"],
    );
    assertEquals(result.title, message);
  });

  await t.step("createPullRequest (update)", async () => {
    const result = await github.createPullRequest(
      repo,
      base,
      branch,
      message + " (updated)",
      ["test"],
    );
    assertEquals(result.title, message + " (updated)");
  });
});
