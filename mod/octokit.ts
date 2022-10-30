import { groupBy } from "https://deno.land/std@0.161.0/collections/group_by.ts";
import { decode } from "https://deno.land/std@0.161.0/encoding/base64.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { Update } from "./common.ts";

type UpdateContent = Pick<Update, "path" | "content">;

interface BlobContent {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

interface Repository {
  owner: string;
  repo: string;
}

const split = (fullname: string): Repository => {
  const [owner, repo] = fullname.split("/");
  return { owner, repo };
};

interface GitHubClientOptions {
  octokit?: Octokit;
  token?: string;
  repository?: string;
}

export class GitHubClient {
  octokit: Octokit;
  repository?: Repository;

  constructor(options?: GitHubClientOptions) {
    if (options?.octokit) {
      this.octokit = options.octokit;
    } else {
      this.octokit = new Octokit({ auth: options?.token });
    }
    if (options?.repository) {
      this.repository = split(options.repository);
    }
  }

  ensureRepository(repository?: string) {
    if (repository) {
      return split(repository);
    }
    if (!this.repository) {
      throw new Error("Repository must be specified");
    }
    return this.repository;
  }

  async getBlobContent(sha: string) {
    const { owner, repo } = this.ensureRepository();

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

  async createBlobContents(
    updates: UpdateContent[],
    tree: { path?: string; sha?: string }[],
  ): Promise<BlobContent[]> {
    const groupByPath = groupBy(updates, (it) => it.path);

    return await Promise.all(
      Object.entries(groupByPath).map(async ([path, updates]) => {
        const blob = tree.find((it) => it.path === path);
        let content = blob
          ? await this.getBlobContent(blob.sha!) // file exists (updating dependencies)
          : ""; // file not exist (installing Denopendabot App)
        for (const update of updates!) {
          content = update.content(content);
        }
        return { path: path, mode: "100644", type: "blob", content };
      }),
    );
  }

  async defaultBranch(repository?: string) {
    const { owner, repo } = this.ensureRepository(repository);

    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}",
      { owner, repo },
    );
    return data.default_branch;
  }

  async getBranch(branch?: string) {
    const { owner, repo } = this.ensureRepository();
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/branches/{branch}",
        { owner, repo, branch: (branch ?? await this.defaultBranch()) },
      );
      return data;
    } catch {
      return null;
    }
  }

  async getTree(branch?: string) {
    const { owner, repo } = this.ensureRepository();

    const head = await this.getBranch(branch);
    if (!head) throw Error(`Branch ${branch} not found.`);

    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
      { owner, repo, tree_sha: head.commit.sha, recursive: "true" },
    );
    // we don't need the subtrees
    return data.tree.filter((it) => it.type === "blob");
  }

  async updateBranch(branch: string, sha: string) {
    const { owner, repo } = this.ensureRepository();

    await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/git/refs/{ref}",
      { owner, repo, ref: `heads/${branch}`, sha, force: true },
    );
  }

  async createCommit(
    branch: string,
    message: string,
    updates: UpdateContent[],
  ) {
    const { owner, repo } = this.ensureRepository();

    // ensure the target branch
    const base = await this.createBranch(branch);

    // create a tree object for updated files
    const baseTree = await this.getTree(branch);
    const blobs = await this.createBlobContents(updates, baseTree);

    // create a new tree on the target branch
    const { data: newTree } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      { owner, repo, tree: blobs, base_tree: base.commit.sha },
    );
    const author = {
      name: "denopendabot",
      email: "denopendabot@github.com",
    };
    // create a new tree on the target branch
    const tree = newTree.sha;
    const parents = [base.commit.sha];

    const { data: commit } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/commits",
      { owner, repo, message, author, tree, parents },
    );
    // update the ref of the branch to the commit
    await this.updateBranch(branch, commit.sha);

    console.debug(`📝 ${commit.message}`);

    return commit;
  }

  async getPullRequests(options?: {
    state: "open" | "closed" | "all";
  }) {
    const { owner, repo } = this.ensureRepository();

    const { data: results } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      { owner, repo, state: options?.state },
    );
    return results;
  }

  async createPullRequest(options: {
    base: string;
    head: string;
    title: string;
    modifiable?: boolean;
    labels?: string[];
  }) {
    const { owner, repo } = this.ensureRepository();
    const { base, head, title, labels, modifiable } = options;

    const prs = await this.getPullRequests({ state: "open" });
    const exists = prs.find((pr) => pr.head.ref === head);

    const { data: created } = exists
      ? await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: exists.number, title },
      )
      : await this.octokit.request(
        "POST /repos/{owner}/{repo}/pulls",
        { owner, repo, title, base, head, maintainer_can_modify: modifiable },
      );
    console.info(
      `🎈 Created a pull request "${created.title}" for ${owner}/${repo}`,
    );

    if (labels?.length) {
      await this.octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
        { owner, repo, issue_number: created.number, labels },
      );
      const { data: labeled } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}",
        { owner, repo, pull_number: created.number },
      );
      return labeled;
    }
    return created;
  }

  async closePullRequest(number: number) {
    const { owner, repo } = this.ensureRepository();

    const { data: result } = await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: number, state: "closed" },
    );
    return result;
  }

  async getLatestCommit(branch?: string) {
    const { owner, repo } = this.ensureRepository();

    const { data: commit } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/commits/{ref}",
      { owner, repo, ref: "heads/" + (branch ?? await this.defaultBranch()) },
    );
    return commit;
  }

  async getLatestRelease(repository?: string) {
    const { owner, repo } = this.ensureRepository(repository);
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

  async compareBranches(options: {
    repository?: string;
    base: string;
    head: string;
  }) {
    const { repository, base, head } = options;
    const { owner, repo } = this.ensureRepository(repository);

    const { data: commits } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/compare/{basehead}",
      { owner, repo, basehead: `${base}...${head}` },
    );
    return commits;
  }

  async createBranch(
    branch: string,
    base?: string,
  ) {
    const { owner, repo } = this.ensureRepository();
    const exists = await this.getBranch(branch);

    // update the branch and return if already exists
    if (exists) {
      const latest = await this.getLatestCommit(base);
      await this.updateBranch(branch, latest.sha);
      return exists;
    }
    // get ref to the base branch
    const { data: baseRef } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner, repo, ref: "heads/" + (base ?? await this.defaultBranch()) },
    );
    // create a new branch (a new ref to an existing ref)
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/refs",
      { owner, repo, ref: `refs/heads/${branch}`, sha: baseRef.object.sha },
    );
    const created = await this.getBranch(branch);

    if (!created) {
      throw new Error(`Failed in creating a branch ${branch}`);
    }
    console.info(`🔨 Created branch ${branch}`);

    return created;
  }

  async deleteBranch(branch: string) {
    const { owner, repo } = this.ensureRepository();
    try {
      await this.octokit.request(
        "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
        { owner, repo, ref: `heads/${branch}` },
      );
      console.info(`Deleted branch ${branch}.`);
    } catch {
      console.info(`Branch ${branch} not exist.`);
    }
  }
}
