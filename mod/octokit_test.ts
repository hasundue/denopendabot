import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "./env.ts";
import { GitHubClient } from "./octokit.ts";
import { RepoUpdate } from "./repo.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-github";
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

Deno.test({
  name: "createBranch",
  ignore: !env.CI,
  fn: async () => {
    const result = await github.createBranch(repo, base);
    assert(result);
  },
});

Deno.test({
  name: "createPullRequest",
  ignore: !env.CI,
  fn: async (t) => {
    await t.step("createBranch", async () => {
      await github.createBranch(repo, branch, base);
    });

    const update = new RepoUpdate("mod.ts", {
      name: "hasundue/denopendabot",
      initial: "0.6.2", // @denopendabot hasundue/denopendabot
      target: "1.0.0",
    });
    const message = update.message();

    await t.step("createCommit", async () => {
      const result = await github.createCommit(repo, branch, message, [update]);
      assertEquals(result.message, message);
    });

    await t.step("createPullRequest (new)", async () => {
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
        message,
        ["test"],
      );
      assertEquals(result.title, message);
    });
  },
});
