import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { Update, UpdateSpec } from "./lib/common.ts";
import * as Module from "./lib/module.ts";
import * as github from "./lib/github.ts";

export async function createPullRequest(
  repo: string,
  options?: {
    branch?: string;
    modules?: UpdateSpec[];
    sources?: string[];
  },
) {
  const base = options?.branch ?? "main";
  const baseTree = await github.getTree(repo, base);

  const targets = options?.sources
    ? baseTree.filter((blob) =>
      options?.sources?.find((it) => blob.path?.match(it))
    )
    : baseTree;

  const updates: Update[] = [];

  for (const entry of targets) {
    const content = await github.getBlobContent(repo, entry.sha!);

    // TS/JS modules
    const moduleSpecs = options?.modules ||
      await Module.getUpdateSpecs(content);

    moduleSpecs.forEach((spec) =>
      updates.push(new Module.Update(entry.path!, spec))
    );
  }

  if (!updates.length) {
    console.log("No updates found.");
    return null;
  }

  const branch = "denopendabot";
  await github.createBranch(repo, branch, base);

  const groupsByDep = groupBy(updates, (it) => it.spec.dep);
  const deps = Object.keys(groupsByDep);

  // create commits for each updated dependency
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    await github.createCommit(repo, branch, message, updates);
  }

  const title = deps.length > 1
    ? "build(deps): update dependencies"
    : updates[0].message();

  return await github.createPullRequest(repo, branch, title, base);
}
