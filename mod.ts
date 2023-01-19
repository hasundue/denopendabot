import { groupBy } from "https://deno.land/std@0.173.0/collections/group_by.ts";
import { intersect } from "https://deno.land/std@0.173.0/collections/intersect.ts";
import { withoutAll } from "https://deno.land/std@0.173.0/collections/without_all.ts";
import { Octokit } from "https://esm.sh/@octokit/core@4.1.0";
import { env } from "./mod/env.ts";
import {
  CommitType,
  pullRequestType,
  removeIgnore,
  Update,
} from "./mod/common.ts";
import { GitHubClient } from "./mod/octokit.ts";
import { getModuleUpdateSpecs, ModuleUpdate } from "./mod/module.ts";
import { getRepoUpdateSpecs, RepoUpdate } from "./mod/repo.ts";

export { VERSION } from "./mod/version.ts";

export type Options = GlobalOptions & UpdateOptions & PullRequestOptions;

interface GlobalOptions {
  octokit?: Octokit;
  token?: string;
  userToken?: string;
  baseBranch?: string;
  workingBranch?: string;
  release?: string;
}

const getActionToken = (options?: GlobalOptions) => {
  const envToken = options?.token && Deno.env.get(options?.token);
  const rawToken = !envToken ? options?.token : undefined;
  return (envToken || rawToken) ?? env.GITHUB_TOKEN;
};

const getUserToken = (options?: GlobalOptions) => {
  const envUserToken = options?.userToken && Deno.env.get(options?.userToken);
  const rawUserToken = !envUserToken ? options?.userToken : undefined;
  return envUserToken ?? rawUserToken;
};

const defaultExcludePaths = [
  "deno.lock",
] as const;

interface UpdateOptions {
  include?: string[];
  exclude?: string[];
  root?: string; // not prefixed with "./"
}

export async function getUpdates(
  repository: string,
  options?: GlobalOptions & UpdateOptions,
) {
  const github = new GitHubClient({
    repository,
    octokit: options?.octokit,
    token: getActionToken(options) ?? getUserToken(options),
  });

  const base = options?.baseBranch ?? await github.defaultBranch();
  const baseTree = await github.getTree(base, options?.root);

  const paths = baseTree.map((blob) => blob.path!);
  const pathsToInclude = options?.include || paths;
  const pathsToExclude = options?.exclude || defaultExcludePaths;

  const pathsToUpdate = withoutAll(
    intersect(paths, pathsToInclude),
    pathsToExclude,
  );

  const blobs = baseTree.filter((blob) => pathsToUpdate.includes(blob.path!));
  const updates: Update[] = [];

  for (const blob of blobs) {
    console.debug(`🔍 ${blob.path}`);

    const content = await github.getBlobContent(blob.sha!);
    const contentToUpdate = removeIgnore(content);

    // TS/JS modules
    const moduleName = repository.split("/")[1].replaceAll("-", "_");
    const moduleReleaseSpec = options?.release
      ? { name: moduleName, target: options.release }
      : undefined;
    const moduleSpecs = await getModuleUpdateSpecs(
      contentToUpdate,
      moduleReleaseSpec,
    );
    moduleSpecs.forEach((spec) =>
      updates.push(new ModuleUpdate(blob.path!, spec))
    );

    // other repositories
    const repoReleaseSpec = options?.release
      ? { name: repository, target: options.release }
      : undefined;

    const repoSpecs = await getRepoUpdateSpecs(
      contentToUpdate,
      repoReleaseSpec,
      github,
    );
    repoSpecs.forEach((spec) => updates.push(new RepoUpdate(blob.path!, spec)));
  }

  return updates;
}

export async function createCommits(
  repository: string,
  updates: Update[],
  options: GlobalOptions,
) {
  const actionToken = getActionToken(options);
  const userToken = getUserToken(options);

  if (!options?.octokit && !actionToken && !userToken) {
    throw new Error("❗ Access token is not provided");
  }

  const github = new GitHubClient({
    repository,
    octokit: options?.octokit,
    token: userToken ?? actionToken,
  });
  const authorized = options?.octokit || userToken;

  // filter out workflows if we are not authorized to update them
  const updatables = !authorized
    ? updates.filter((update) => !update.isWorkflow())
    : updates;

  const branch = options?.workingBranch ?? "denopendabot";

  const latest = await github.getLatestCommit(options?.baseBranch);

  const groupsByDep = groupBy(updatables, (it) => it.spec.name);
  const deps = Object.keys(groupsByDep);

  // create commits for each updated dependency
  let sha = latest.sha;
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    const commit = await github.createCommit(sha, message, updates);
    sha = commit.sha;
  }

  await github.createBranch(branch, options?.baseBranch);
  await github.updateBranch(branch, sha);

  if (!authorized) {
    console.info(
      "📣 Skipped the workflow files since we are not authorized to update them.",
    );
  }
}

interface PullRequestOptions {
  labels?: string[];
}

export async function createPullRequest(
  repository: string,
  options?: GlobalOptions & PullRequestOptions,
) {
  const actionToken = getActionToken(options);
  const userToken = getUserToken(options);

  if (!options?.octokit && !actionToken && !userToken) {
    throw new Error("❗ Access token is not provided");
  }

  const github = new GitHubClient({
    repository,
    octokit: options?.octokit,
    token: actionToken ?? userToken,
  });
  const base = options?.baseBranch ?? await github.defaultBranch();
  const head = options?.workingBranch ?? "denopendabot";

  const { commits } = await github.compareBranches({ base, head });

  if (!commits.length) {
    console.info(`📣 ${base} and ${head} are identical`);
    return null;
  }

  const messages = commits.map((commit) => commit.commit.message);

  const types = intersect(
    messages.map((message) => {
      if (!message.includes(":")) {
        return null;
      }
      return message.split(":")[0].split("(")[0];
    }),
    CommitType,
  ) as CommitType[];

  const version = await github.getLatestRelease(repository);

  const type = pullRequestType(types);
  const scope = options?.release ? "version" : "deps";
  const body = options?.release
    ? `bump the version from ${version} to ${options.release}`
    : "update dependencies";
  const title = `${type}(${scope}): ${body}`;

  return await github.createPullRequest({
    base,
    head,
    title,
    modifiable: true,
    labels: options?.labels,
  });
}
