import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { intersect } from "https://deno.land/std@0.159.0/collections/intersect.ts";
import { withoutAll } from "https://deno.land/std@0.159.0/collections/without_all.ts";
import { env } from "./lib/env.ts";
import { pullRequestType, Update } from "./lib/common.ts";
import { Client } from "./lib/github.ts";
import * as module from "./lib/module.ts";
import * as repo from "./lib/repo.ts";

export const VERSION = "0.5.0"; // @denopendabot hasundue/denopendabot

interface Options {
  base?: string;
  branch?: string;
  release?: string;
  include?: string[];
  exclude?: string[];
  dryRun?: true;
  token?: string;
}

export async function createPullRequest(
  repository: string,
  options?: Options,
) {
  if (!options?.token && !env.GH_TOKEN && !env.GITHUB_TOKEN) {
    throw Error("❗ Access token not provided");
  }
  const github = new Client(options?.token);

  const base = options?.base ?? "main";
  const baseTree = await github.getTree(repository, base);

  const paths = baseTree.map((blob) => blob.path!);
  const pathsToInclude = options?.include || paths;
  const pathsToExclude = options?.exclude || [];

  const pathsToUpdate = withoutAll(
    intersect(paths, pathsToInclude),
    pathsToExclude,
  );

  const blobs = baseTree.filter((blob) => pathsToUpdate.includes(blob.path!));
  const updates: Update[] = [];

  for (const blob of blobs) {
    console.log(`🔍 ${blob.path}`);
    const content = await github.getBlobContent(repository, blob.sha!);

    // TS/JS modules
    const moduleSpecs = await module.getUpdateSpecs(content);

    moduleSpecs.forEach((spec) =>
      updates.push(new module.Update(blob.path!, spec))
    );

    // other repositories
    const releaseSpec = options?.release
      ? { name: repository, target: options.release }
      : undefined;

    const repoSpecs = await repo.getUpdateSpecs(github, content, releaseSpec);

    repoSpecs.forEach((spec) =>
      updates.push(new repo.Update(blob.path!, spec))
    );
  }

  // no updates found or a dry-run
  if (!updates.length || options?.dryRun) return null;

  // check if we are authoried to update workflows
  const unauthorized = !options?.token && !env.GH_TOKEN;

  // filter out workflows if we are not authorized to update them
  const updatables = unauthorized
    ? updates.filter((update) => !update.isWorkflow())
    : updates;

  const branch = options?.branch ?? "denopendabot";
  await github.createBranch(repository, branch, base);

  const groupsByDep = groupBy(updatables, (it) => it.spec.name);
  const deps = Object.keys(groupsByDep);

  // create commits for each updated dependency
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    await github.createCommit(repository, branch, message, updates);
  }

  if (unauthorized) {
    console.log(
      "📣 Skipped the workflow files since we are not authorized to update them.",
    );
  }

  const type = pullRequestType(updates);

  const title = deps.length > 1
    ? `${type}(deps): update dependencies`
    : updates[0].message();

  return await github.createPullRequest(repository, branch, title, base);
}
