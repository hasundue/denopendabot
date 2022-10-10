import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { Update, UpdateSpec } from "./lib/common.ts";
import * as github from "./lib/github.ts";
import * as module from "./lib/module.ts";
import * as repo from "./lib/repo.ts";

interface Options {
  branch?: string;
  release?: string;
  includes?: string[];
  excludes?: string[];
}

export async function createPullRequest(
  repository: string,
  options?: Options,
) {
  const base = options?.branch ?? "main";
  const baseTree = await github.getTree(repository, base);

  const targets = options?.includes
    ? baseTree.filter((blob) =>
      options?.includes?.find((it) => blob.path?.match(it))
    )
    : baseTree;

  const updates: Update[] = [];

  for (const entry of targets) {
    const content = await github.getBlobContent(repository, entry.sha!);

    // TS/JS modules
    const moduleSpecs: UpdateSpec[] = options?.release
      ? [{ name: repository, target: options.release }]
      : await module.getUpdateSpecs(content);

    moduleSpecs.forEach((spec) =>
      updates.push(new module.Update(entry.path!, spec))
    );

    // other repositories
    const repoSpecs = await repo.getUpdateSpecs(content);

    repoSpecs.forEach((spec) =>
      updates.push(new repo.Update(entry.path!, spec))
    );
  }

  if (!updates.length) {
    console.log("No updates found.");
    return null;
  }

  const branch = "denopendabot";
  await github.createBranch(repository, branch, base);

  const groupsByDep = groupBy(updates, (it) => it.spec.name);
  const deps = Object.keys(groupsByDep);

  // create commits for each updated dependency
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    await github.createCommit(repository, branch, message, updates);
  }

  const title = deps.length > 1
    ? "build(deps): update dependencies"
    : updates[0].message();

  return await github.createPullRequest(repository, branch, title, base);
}
