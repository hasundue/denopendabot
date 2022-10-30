import { env } from "../mod/env.ts";
import { GitHubClient } from "../mod/octokit.ts";

const github = new GitHubClient({
  repository: env.GITHUB_REPOSITORY,
  token: env.GITHUB_TOKEN,
});

await github.deleteBranch("test-action-" + env.GITHUB_REF_NAME);
