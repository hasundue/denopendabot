import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.0.5";
import { Update as ModuleUpdate } from "./module.ts";
import { env } from "./env.ts";

const octokit = new Octokit({
  auth: env["GITHUB_TOKEN"] ?? env["GH_TOKEN"],
});

export async function getLatestRelease(
  repository: string,
): Promise<string | null> {
  const [owner, repo] = repository.split("/");
  try {
    const { data: release } = await octokit.request(
      "GET /repos/{owner}/{repo}/releases/latest",
      { owner, repo },
    );
    return release.tag_name;
  } catch {
    return null;
  }
}

function createBlob(path: string, content: string): Blob {
  return { path, mode: "100644", type: "blob", content };
}

interface Blob {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

export async function getBranch(
  repository: string,
  branch: string,
) {
  const [owner, repo] = repository.split("/");
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/branches/{branch}",
      { owner, repo, branch },
    );
    return data;
  } catch {
    return null;
  }
}

export async function createCommit(
  repository: string,
  branch: string,
  updates: ModuleUpdate[],
) {
  const [owner, repo] = repository.split("/");

  // create a tree object for updated files
  const treeObject: Blob[] = updates.map((update) =>
    createBlob(update.path, update.output)
  );

  // get a reference to the target branch
  const base = await getBranch(repository, branch);

  if (!base) throw Error(`Branch ${branch} not found`);

  // create a new tree on the target branch
  const { data: tree } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    { owner, repo, tree: treeObject, base_tree: base.commit.sha },
  );

  const { url, target } = updates[0];
  const message = `build(deps): bump ${url} to ${target}`;

  const author = {
    name: "denopendabot",
    email: "denopendabot@gmail.com",
  };

  // create a new tree on the target branch
  const { data: commit } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    {
      owner,
      repo,
      message,
      author,
      tree: tree.sha,
      parents: [base.commit.sha],
    },
  );

  // update ref of the branch to the commit
  await octokit.request(
    "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
    { owner, repo, ref: `heads/${branch}`, sha: commit.sha },
  );

  console.log(`Created a commit: ${commit.message}.`);

  return commit;
}

export async function getCommit(
  repository: string,
  branch = "main",
) {
  const [owner, repo] = repository.split("/");

  const { data: commit } = await octokit.request(
    "GET /repos/{owner}/{repo}/commits/{ref}",
    { owner, repo, ref: `heads/${branch}` },
  );

  return commit;
}

export async function createBranch(
  repository: string,
  branch: string,
  base = "main",
) {
  const [owner, repo] = repository.split("/");

  const exists = await getBranch(repository, branch);

  if (exists) {
    console.log(`Branch ${branch} already exists.`);
    return;
  }

  // get a reference to main branch
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    { owner, repo, ref: `heads/${base}` },
  );

  // create a branch
  const { data: result } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/refs",
    { owner, repo, ref: `refs/heads/${branch}`, sha: data.object.sha },
  );

  console.log(`Created a branch ${result.ref}.`);

  return result;
}

export async function deleteBranch(
  repository: string,
  branch: string,
) {
  const [owner, repo] = repository.split("/");

  await octokit.request(
    "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
    { owner, repo, ref: `heads/${branch}` },
  );

  console.log(`Deleted a branch ${branch}.`);
}

export async function createPullRequest(
  repository: string,
  branch: string,
  updates: ModuleUpdate[],
  base = "main",
) {
  const [owner, repo] = repository.split("/");

  const groups = groupBy(updates, (update) => update.url.toString());
  const length = Object.keys(groups).length;

  if (!length) throw Error("Unable to make a PR with no updates.");

  for (const dep of Object.keys(groups)) {
    await createCommit(repository, branch, groups[dep]!);
  }

  const title = length > 1
    ? "build(deps): update dependencies"
    : (await getCommit(repository, branch)).commit.message;

  const { data: result } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    { owner, repo, title, base, head: branch },
  );

  console.log(`Created a PR: ${result.title}.`);

  return result;
}

export async function getPullRequests(
  repository: string,
) {
  const [owner, repo] = repository.split("/");

  const { data: results } = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    { owner, repo },
  );

  return results;
}
