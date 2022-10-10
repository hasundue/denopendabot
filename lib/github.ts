import { decode } from "https://deno.land/std@0.159.0/encoding/base64.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.0.5";
import { Update } from "./common.ts";
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

async function createBlobContents(
  repository: string,
  updates: Update[],
  tree: { path?: string; sha?: string }[],
): Promise<BlobContent[]> {
  return await Promise.all(updates.map(async (update) => {
    const blob = tree.find((it) => it.path === update.path);
    const content = update.content(
      await getBlobContent(repository, blob!.sha!),
    );
    return { path: update.path, mode: "100644", type: "blob", content };
  }));
}

interface BlobContent {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

export async function createCommit(
  repository: string,
  branch: string,
  message: string,
  updates: Update[],
) {
  const [owner, repo] = repository.split("/");

  // get a reference to the target branch
  const base = await getBranch(repository, branch);
  if (!base) throw Error(`Branch ${branch} not found`);

  const baseTree = await getTree(repository, branch);

  // create a tree object for updated files
  const blobs = await createBlobContents(repository, updates, baseTree);

  // create a new tree on the target branch
  const { data: newTree } = await octokit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    { owner, repo, tree: blobs, base_tree: base.commit.sha },
  );

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
      tree: newTree.sha,
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
    await deleteBranch(repository, branch);
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

  console.log(`Created a branch ${branch}.`);
  return result;
}

export async function updateBranch(
  repository: string,
  branch: string,
  base = "main",
) {
  const [owner, repo] = repository.split("/");

  const baseCommit = await getCommit(repository, base);

  await octokit.request(
    "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
    { owner, repo, ref: `heads/${branch}`, sha: baseCommit.sha, force: true },
  );
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
  title: string,
  base = "main",
) {
  const [owner, repo] = repository.split("/");

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

export async function getTree(
  repository: string,
  branch = "main",
) {
  const [owner, repo] = repository.split("/");

  const head = await getBranch(repository, branch);

  if (!head) throw Error(`Branch ${branch} not found.`);

  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    { owner, repo, tree_sha: head.commit.sha, recursive: "true" },
  );

  // we don't need subtrees anymore
  return data.tree.filter((it) => it.type === "blob");
}

export async function getBlobContent(
  repository: string,
  sha: string,
) {
  const [owner, repo] = repository.split("/");

  const { data: blob } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
    { owner, repo, file_sha: sha },
  );

  if (blob.encoding !== "base64") {
    console.error(blob);
    throw Error("Unsupported file encoding.");
  }

  return new TextDecoder().decode(decode(blob.content));
}
