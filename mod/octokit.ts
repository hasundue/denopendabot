import { groupBy } from "https://deno.land/std@0.160.0/collections/group_by.ts";
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
    const groupByPath = groupBy(updates, (it) => it.path);

    return await Promise.all(
      Object.entries(groupByPath).map(async ([path, updates]) => {
        const blob = tree.find((it) => it.path === path);
        let content = await this.getBlobContent(repository, blob!.sha!);
        for (const update of updates!) {
          content = update.content(content);
        }
        return { path: path, mode: "100644", type: "blob", content };
      }),
    );
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

      // update the ref of the branch to the commit
      await this.updateBranch(repository, branch, commit.sha);

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
      await this.updateBranch(repository, branch, baseRef.sha);
      return exists;
    }

    // get a reference to the base branch
    const { data: baseRef } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner, repo, ref: `heads/${base}` },
    );

    // create a branch
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/refs",
      { owner, repo, ref: `refs/heads/${branch}`, sha: baseRef.object.sha },
    );
    const created = (await this.getBranch(repository, branch))!;

    console.log(`🔨 Created branch ${branch}`);
    return created;
  }

  async updateBranch(
    repository: string,
    branch: string,
    sha: string,
  ) {
    const [owner, repo] = repository.split("/");

    await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
      { owner, repo, ref: `heads/${branch}`, sha, force: true },
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
      console.log(`🗑️ Deleted branch ${branch}.`);
    } catch {
      console.info(`Branch ${branch} not exist.`);
    }
  }

  async createPullRequest(
    repository: string,
    base: string,
    branch: string,
    title: string,
    labels = ["dependencies"],
  ) {
    const [owner, repo] = repository.split("/");

    const prs = await this.getPullRequests(repository, "open");
    const relevant = prs.find((pr) => pr.head.ref === branch);

    const { data: result } = relevant
      ? await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: relevant.number, title },
      )
      : await this.octokit.request(
        "POST /repos/{owner}/{repo}/pulls",
        { owner, repo, title, base, head: branch },
      );

    // add a label if given
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      { owner, repo, issue_number: result.number, labels },
    );

    console.log(`🚀 Created a pull request "${result.title}"`);

    return result;
  }

  async getPullRequests(
    repository: string,
    state: "open" | "closed" | "all" = "open",
  ) {
    const [owner, repo] = repository.split("/");

    const { data: results } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      { owner, repo, state },
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
