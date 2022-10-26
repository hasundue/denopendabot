import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
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
  assertEquals(tag, VERSION);
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

Deno.test("createBranch", { ignore: !env.CI }, async () => {
  const result = await github.createBranch(repo, base);
  assert(result);
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
      message + "(updated)",
      ["test"],
    );
    assertEquals(result.title, message + "(updated)");
  });
});
