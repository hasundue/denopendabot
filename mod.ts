import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { intersect } from "https://deno.land/std@0.159.0/collections/intersect.ts";
import { withoutAll } from "https://deno.land/std@0.159.0/collections/without_all.ts";
import { pullRequestType, Update } from "./lib/common.ts";
import { Client } from "./lib/github.ts";
import { getOctokit } from "./lib/app.ts";
import * as module from "./lib/module.ts";
import * as repo from "./lib/repo.ts";

export const VERSION = "0.1.0"; // @denopendabot hasundue/denopendabot

interface Options {
  base?: string;
  branch?: string;
  release?: string;
  include?: string[];
  exclude?: string[];
}

export async function getBlobsToUpdate(
  repository: string,
  options?: Options,
) {
  const github = new Client(await getOctokit(repository));
  const base = options?.base ?? "main";

  const baseTree = await github.getTree(repository, base);

  const paths = baseTree.map((blob) => blob.path!);
  const pathsToInclude = options?.include || paths;
  const pathsToExclude = options?.exclude || [];

  const pathsToUpdate = withoutAll(
    intersect(paths, pathsToInclude),
    pathsToExclude,
  );

  return baseTree.filter((blob) => pathsToUpdate.includes(blob.path!));
}

export async function createPullRequest(
  repository: string,
  options?: Options,
) {
  const github = new Client(await getOctokit(repository));
  const base = options?.base ?? "main";

  const blobs = await getBlobsToUpdate(repository, options);
  const updates: Update[] = [];

  for (const blob of blobs) {
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

    const repoSpecs = await repo.getUpdateSpecs(content, releaseSpec);

    repoSpecs.forEach((spec) =>
      updates.push(new repo.Update(blob.path!, spec))
    );
  }

  if (!updates.length) {
    console.log("No updates found.");
    return null;
  }

  const branch = options?.branch || "denopendabot";
  await github.createBranch(repository, branch, base);

  const groupsByDep = groupBy(updates, (it) => it.spec.name);
  const deps = Object.keys(groupsByDep);

  // create commits for each updated dependency
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    await github.createCommit(repository, branch, message, updates);
  }

  const type = pullRequestType(updates);

  const title = deps.length > 1
    ? `${type}(deps): update dependencies`
    : updates[0].message();

  return await github.createPullRequest(repository, branch, title, base);
}
