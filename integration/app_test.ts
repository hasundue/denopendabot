import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.161.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.161.0/async/mod.ts";
import { createCommits, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { env } from "../mod/env.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-app";
const initial = "0.7.2"; // @denopendabot hasundue/denopendabot
const target = "1.0.0";

const github = new GitHubClient(env.get("GITHUB_TOKEN"));

Deno.test("integration (app)", async () => {
  await github.createBranch(repo, base);

  const options = {
    base,
    branch,
    release: target,
    include: ["mod.ts"],
    test: true,
  };

  const updates = await getUpdates(repo, options);

  const created = new Date();
  await createCommits(repo, updates, options);

  // wait for a minute until the app completes merging the pull request
  await delay(60 * 1000);

  const prs = await github.getPullRequests(repo, "closed");
  const merged = prs.find((pr) =>
    pr.user?.login === "denopendabot[bot]" &&
    new Date(pr.created_at) > created &&
    pr.merged_at
  );
  assert(merged);
  assertEquals(
    merged.title,
    `build(version): bump the version from ${initial} to ${target}`,
  );
});
