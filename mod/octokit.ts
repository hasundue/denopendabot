import { decode } from "https://deno.land/std@0.160.0/encoding/base64.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { Update } from "./common.ts";

interface BlobContent {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

export class GitHubClient {
  octokit: Octokit;

  constructor(
    octokit?: Octokit | string,
  ) {
    if (!octokit || typeof octokit === "string") {
      this.octokit = new Octokit({ auth: octokit });
    } else {
      this.octokit = octokit;
    }
  }

  async getLatestRelease(
    repository: string,
  ) {
    const [owner, repo] = repository.split("/");
    try {
      const { data: release } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/releases/latest",
        { owner, repo },
      );
      return release.tag_name;
    } catch {
      return undefined;
    }
  }

  async getDefaultBranchName(
    repository: string,
  ) {
    const [owner, repo] = repository.split("/");
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}",
      { owner, repo },
    );
    return data.default_branch;
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
    try {
      const { data: newTree } = await this.octokit.request(
        "POST /repos/{owner}/{repo}/git/trees",
        { owner, repo, tree: blobs, base_tree: base.commit.sha },
      );

      const author = {
        name: "denopendabot-action",
        email: "denopendabot@gmail.com",
      };

      // create a new tree on the target branch
      const tree = newTree.sha;
      const parents = [base.commit.sha];

      const { data: commit } = await this.octokit.request(
        "POST /repos/{owner}/{repo}/git/commits",
        { owner, repo, message, author, tree, parents },
      );

      // update ref of the branch to the commit
      await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
        { owner, repo, ref: `heads/${branch}`, sha: commit.sha },
      );

      console.log(`📝 ${commit.message}`);

      return commit;
    } catch (error) {
      if (updates.find((update) => update.isWorkflow())) {
        throw Error("❗ Unauthorized to update workflows");
      }
      throw error;
    }
  }

  async getLatestCommit(
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

  async compareBranches(
    repository: string,
    base: string,
    head: string,
  ) {
    const [owner, repo] = repository.split("/");

    const { data: commits } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/compare/{basehead}",
      { owner, repo, basehead: `${base}...${head}` },
    );

    return commits;
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
      const baseRef = await this.getLatestCommit(repository, base);
      await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
        { owner, repo, ref: `heads/${branch}`, sha: baseRef.sha, force: true },
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

    const baseCommit = await this.getLatestCommit(repository, base);

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
    base: string,
    branch: string,
    title: string,
    label?: string,
  ) {
    const [owner, repo] = repository.split("/");

    const prs = await this.getPullRequests(repository);
    const relevant = prs.find((pr) => pr.head.ref === branch);

    const { data: result } = relevant
      // pull request by denopendabot already exists
      ? await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: relevant.number, title },
      )
      // create a new pull request
      : await this.octokit.request(
        "POST /repos/{owner}/{repo}/pulls",
        { owner, repo, title, base, head: branch, label },
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
