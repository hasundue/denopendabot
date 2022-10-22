import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.160.0/async/mod.ts";
import { parse } from "https://deno.land/std@0.160.0/datetime/mod.ts";
import { createCommits, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { env } from "../mod/env.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-app";
const initial = "0.6.2"; // @denopendabot hasundue/denopendabot
const target = "1.0.0";

const github = new GitHubClient(env.GITHUB_TOKEN);

Deno.test("integration (app)", async () => {
  await github.createBranch(repo, base, env.HEAD_BRANCH);

  const options = {
    base,
    branch,
    release: target,
    include: ["mod.ts"],
    test: true,
  };

  const updates = await getUpdates(repo, options);
  await createCommits(repo, updates, options);

  // wait for a minute until the app complete merging the pull request
  const created = new Date();
  await delay(60 * 1000);

  const prs = await github.getPullRequests(repo);
  const merged = prs.find((pr) =>
    pr.user?.login === "denopendabot[bot]" &&
    parse(pr.created_at) > created &&
    pr.merged_at
  );
  assert(merged);
  assertEquals(
    merged.title,
    `build(version): bump the version from ${initial} to ${target}`,
  );
});
