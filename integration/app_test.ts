import { createCommits, getUpdates } from "../mod.ts";
import { GitHubClient } from "../mod/octokit.ts";
import { env } from "../mod/env.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-app";
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
});
