import { decode } from "https://deno.land/std@0.159.0/encoding/base64.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.0.5";
import { Update } from "./common.ts";
import { env } from "./env.ts";

interface BlobContent {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

export class Client {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token ?? env["GH_TOKEN"] ?? env["GITHUB_TOKEN"],
    });
  }

  async getLatestRelease(
    repository: string,
  ): Promise<string | null> {
    const [owner, repo] = repository.split("/");
    try {
      const { data: release } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/releases/latest",
        { owner, repo },
      );
      return release.tag_name;
    } catch {
      return null;
    }
  }

  async getBranch(
    repository: string,
    branch: string,
  ) {
    const [owner, repo] = repository.split("/");
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/branches/{branch}",
        { owner, repo, branch },
      );
      return data;
    } catch {
      return null;
    }
  }

  async createBlobContents(
    repository: string,
    updates: Update[],
    tree: { path?: string; sha?: string }[],
  ): Promise<BlobContent[]> {
    return await Promise.all(updates.map(async (update) => {
      const blob = tree.find((it) => it.path === update.path);
      const content = update.content(
        await this.getBlobContent(repository, blob!.sha!),
      );
      return { path: update.path, mode: "100644", type: "blob", content };
    }));
  }

  async createCommit(
    repository: string,
    branch: string,
    message: string,
    updates: Update[],
  ) {
    const [owner, repo] = repository.split("/");

    // get a reference to the target branch
    const base = await this.getBranch(repository, branch);
    if (!base) throw Error(`Branch ${branch} not found`);

    const baseTree = await this.getTree(repository, branch);

    // create a tree object for updated files
    const blobs = await this.createBlobContents(repository, updates, baseTree);

    // create a new tree on the target branch
    const { data: newTree } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      { owner, repo, tree: blobs, base_tree: base.commit.sha },
    );

    const author = {
      name: "denopendabot",
      email: "denopendabot@gmail.com",
    };

    // create a new tree on the target branch
    const { data: commit } = await this.octokit.request(
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
    await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
      { owner, repo, ref: `heads/${branch}`, sha: commit.sha },
    );

    console.log(`📝 ${commit.message}`);

    return commit;
  }

  async getCommit(
    repository: string,
    branch = "main",
  ) {
    const [owner, repo] = repository.split("/");

    const { data: commit } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/commits/{ref}",
      { owner, repo, ref: `heads/${branch}` },
    );

    return commit;
  }

  async createBranch(
    repository: string,
    branch: string,
    base = "main",
  ) {
    const [owner, repo] = repository.split("/");

    const exists = await this.getBranch(repository, branch);

    if (exists) {
      // update the ref
      const baseRef = await this.getCommit(repository, base);
      await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
        { owner, repo, ref: `heads/${branch}`, sha: baseRef.sha },
      );
      return exists;
    }

    // get a reference to main branch
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner, repo, ref: `heads/${base}` },
    );

    // create a branch
    const { data: result } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/refs",
      { owner, repo, ref: `refs/heads/${branch}`, sha: data.object.sha },
    );

    console.log(`🔨 branch ${branch}`);
    return result;
  }

  async updateBranch(
    repository: string,
    branch: string,
    base = "main",
  ) {
    const [owner, repo] = repository.split("/");

    const baseCommit = await this.getCommit(repository, base);

    await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
      { owner, repo, ref: `heads/${branch}`, sha: baseCommit.sha, force: true },
    );
  }

  async deleteBranch(
    repository: string,
    branch: string,
  ) {
    const [owner, repo] = repository.split("/");

    try {
      await this.octokit.request(
        "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
        { owner, repo, ref: `heads/${branch}` },
      );
      console.log(`🗑️ branch ${branch}.`);
    } catch {
      console.log(`Branch ${branch} not exist.`);
    }
  }

  async createPullRequest(
    repository: string,
    branch: string,
    title: string,
    base = "main",
  ) {
    const [owner, repo] = repository.split("/");

    const { data: result } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      { owner, repo, title, base, head: branch },
    );

    console.log(`🚀 ${result.title}`);

    return result;
  }

  async getPullRequests(
    repository: string,
  ) {
    const [owner, repo] = repository.split("/");

    const { data: results } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      { owner, repo },
    );

    return results;
  }

  async getTree(
    repository: string,
    branch = "main",
  ) {
    const [owner, repo] = repository.split("/");

    const head = await this.getBranch(repository, branch);

    if (!head) throw Error(`Branch ${branch} not found.`);

    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: head.commit.sha, recursive: "true" },
    );

    // we don't need subtrees anymore
    return data.tree.filter((it) => it.type === "blob");
  }

  async getBlobContent(
    repository: string,
    sha: string,
  ) {
    const [owner, repo] = repository.split("/");

    const { data: blob } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
      { owner, repo, file_sha: sha },
    );

    if (blob.encoding !== "base64") {
      console.error(blob);
      throw Error("Unsupported file encoding.");
    }

    return new TextDecoder().decode(decode(blob.content));
  }
}
