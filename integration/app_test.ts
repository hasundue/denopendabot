import { assert } from "https://deno.land/std@0.161.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.161.0/async/mod.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { env } from "../app/env.ts";

if (!env.GITHUB_REPOSITORY || !env.GITHUB_REPOSITORY_OWNER) {
  throw new Error(
    "Unable to find repository information in environment variables",
  );
}
const repository = env.GITHUB_REPOSITORY;
const owner = env.GITHUB_REPOSITORY_OWNER;
const repo = repository.split("/")[1];

Deno.test("installation", async () => {
  // Octokit authorized to install/uninstall the app
  const octokit = new Octokit({ auth: env.GH_TOKEN });

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

  // Delete the branch for testing if exists
  try {
    await octokit.request(
      "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
      { owner, repo, ref: `heads/test-install` },
    );
    console.log("👋 Deleted a branch `test-install`");
  } catch {
    console.log("Branch `test-install` does not exists");
  }

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

  // wait for a moment until the app completes creating a pull request
  await delay(10 * 1000);

  // check if a pull request is created to setup denopendabot.yml
  const { data: prs } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    { owner, repo, state: "open" },
  );
  const created = prs.find((pr) =>
    pr.user?.login === "denopendabot[bot]" &&
    new Date(pr.created_at) > started_at &&
    pr.title === "Setup Denopendabot"
  );
  assert(created);
});

Deno.test("run update", async () => {
  const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

  const started_at = new Date();

  // dispatch a `denopendabot-run` event
  await octokit.request("POST /repos/{owner}/{repo}/dispatches", {
    owner,
    repo,
    event_type: "denopendabot-run",
    client_payload: {
      baseBranch: "test",
      workingBranch: "test-app",
      include: "integration/src/deps.ts",
      autoMerge: "any",
    },
  });
  console.info("Dispatched a 'denopendabot-run' event");

  // wait for a moment until the app completes the routine
  await delay(10 * 1000);

  // check if a pull request has been created
  const { data: prs } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    { owner, repo, state: "open" },
  );
  const created = prs.find((pr) =>
    pr.user?.login === "denopendabot[bot]" &&
    new Date(pr.created_at) > started_at &&
    pr.base.ref === "test" &&
    pr.head.ref === "test-app"
  );
  assert(created);

  // wait for a minute until the app completes merging the pull request
  await delay(60 * 1000);

  // check if the pull request has been merged
  const { data: pr } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    { owner, repo, pull_number: created.number },
  );
  assert(pr.merged);
});
