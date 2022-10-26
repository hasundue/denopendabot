import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { env } from "./env.ts";
import { GitHubClient } from "./octokit.ts";

const repo = "hasundue/denopendabot";
const github = new GitHubClient(env["GITHUB_TOKEN"]);

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
