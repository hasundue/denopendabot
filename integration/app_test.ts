import { assert } from "https://deno.land/std@0.185.0/testing/asserts.ts";
import { retry } from "https://deno.land/std@0.185.0/async/mod.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.2.0";
import { env } from "../app/env.ts";
import { GitHubClient } from "../mod/octokit.ts";

if (!env.GITHUB_REPOSITORY || !env.GITHUB_REPOSITORY_OWNER) {
  throw new Error(
    "Unable to find repository information in environment variables",
  );
}
const repository = env.GITHUB_REPOSITORY;
const owner = env.GITHUB_REPOSITORY_OWNER;
const repo = repository.split("/")[1];

Deno.test("app", async (t) => {
  await t.step("installation", async () => {
    const octokit = new Octokit({ auth: env.GH_TOKEN });
    const github = new GitHubClient({ repository, token: env.GITHUB_TOKEN });

    // get repository data
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}",
      { owner, repo },
    );
    // remove the repository from the registration if already exists
    const res = await octokit.request(
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}",
      {
        installation_id: Number(env.INSTALLATION_ID),
        repository_id: data.id,
      },
    );
    if (res.status === 204) {
      console.log("👋 Uninstalled Denopendabot");
    }

    // ensure the base branch
    await github.deleteBranch("test-install");
    await github.createBranch("test-install");
    const latest = await github.getLatestCommit();
    await github.updateBranch("test-install", latest.sha);

    const started_at = new Date();

    // Register the repository to the installation
    await octokit.request(
      "PUT /user/installations/{installation_id}/repositories/{repository_id}",
      {
        installation_id: Number(env.INSTALLATION_ID),
        repository_id: data.id,
      },
    );
    console.log("🚀 Installed Denopendabot");

    // check if a pull request is created to setup denopendabot.yml
    const created = await retry(async () => {
      const { data: prs } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls",
        { owner, repo, state: "open" },
      );
      return prs.find((pr) =>
        pr.user?.login === "denopendabot[bot]" &&
        new Date(pr.created_at) > started_at &&
        pr.title === "Setup Denopendabot"
      );
    }, { maxAttempts: 10 });
    assert(created);

    await github.deleteBranch(created.head.ref);
  });

  await t.step("run update", async () => {
    const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
    const github = new GitHubClient({ repository, token: env.GITHUB_TOKEN });

    const started_at = new Date();

    const base = "test-app";
    const working = "test-app-" + env.GITHUB_REF_NAME;

    // ensure the base branch
    await github.createBranch(base);

    // dispatch a `denopendabot-run` event
    await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
      owner,
      repo,
      event_type: "denopendabot-run",
      client_payload: {
        baseBranch: base,
        workingBranch: working,
        root: "integration/src",
        autoMerge: "any",
      },
    });
    console.info("Dispatched a 'denopendabot-run' event");

    // check if a pull request has been created
    const created = await retry(async () => {
      const { data: prs } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls",
        { owner, repo, state: "open" },
      );
      return prs.find((pr) =>
        pr.user?.login === "denopendabot[bot]" &&
        new Date(pr.updated_at) > started_at &&
        pr.base.ref === base &&
        pr.head.ref === working
      );
    }, { maxAttempts: 10 });
    assert(created, "Pull request has not been created");

    // check if the pull request has been merged
    const merged = await retry(async () => {
      const { data: pr } = await octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: created.number },
      );
      return pr.merged;
    });
    assert(merged, "Pull request has not been merged");

    await github.deleteBranch(base);
    await github.deleteBranch(working);
  });
});
