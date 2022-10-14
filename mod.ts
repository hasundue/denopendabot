import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { intersect } from "https://deno.land/std@0.159.0/collections/intersect.ts";
import { withoutAll } from "https://deno.land/std@0.159.0/collections/without_all.ts";
import { env } from "./lib/env.ts";
import { pullRequestType, removeIgnore, Update } from "./lib/common.ts";
import { Client } from "./lib/github.ts";
import * as module from "./lib/module.ts";
import * as repo from "./lib/repo.ts";

export const VERSION = "1.0.0"; // @denopendabot hasundue/denopendabot

interface Options {
  base?: string;
  branch?: string;
  release?: string;
  include?: string[];
  exclude?: string[];
  dryRun?: true;
  token?: string;
  userToken?: string;
  isTest?: boolean;
}

export async function createPullRequest(
  repository: string,
  options?: Options,
) {
  const actionToken = options?.token ?? env.GITHUB_TOKEN;
  if (!actionToken) {
    console.log("📣 Access token not provided. Switch to dry-run mode.");
  }
  // github client to run the workflow
  const actor = new Client(actionToken);

  const base = options?.base ?? "main";
  const baseTree = await actor.getTree(repository, base);

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

    const content = await actor.getBlobContent(repository, blob.sha!);
    const contentToUpdate = removeIgnore(content);

    // TS/JS modules
    const moduleName = repository.split("/")[1].replaceAll("-", "_");
    const moduleReleaseSpec = options?.release
      ? { name: `https://deno.land/x/${moduleName}`, target: options.release }
      : undefined;

    const moduleSpecs = await module.getUpdateSpecs(
      contentToUpdate,
      moduleReleaseSpec,
    );

    moduleSpecs.forEach((spec) =>
      updates.push(new module.Update(blob.path!, spec))
    );

    // other repositories
    const repoReleaseSpec = options?.release
      ? { name: repository, target: options.release }
      : undefined;

    const repoSpecs = await repo.getUpdateSpecs(
      actor,
      contentToUpdate,
      repoReleaseSpec,
    );

    repoSpecs.forEach((spec) =>
      updates.push(new repo.Update(blob.path!, spec))
    );
  }

  // no updates found or a dry-run
  if (!updates.length || options?.dryRun) return null;

  // check if we are authoried to update workflows
  const userToken = options?.userToken ?? env.GH_TOKEN;

  // filter out workflows if we are not authorized to update them
  const updatables = userToken
    ? updates.filter((update) => !update.isWorkflow())
    : updates;

  const branch = options?.branch ?? "denopendabot";
  await actor.createBranch(repository, branch, base);

  const groupsByDep = groupBy(updatables, (it) => it.spec.name);
  const deps = Object.keys(groupsByDep);

  const commiter = userToken ? new Client(userToken) : actor;

  // create commits for each updated dependency
  for (const dep of deps) {
    const updates = groupsByDep[dep]!;
    const message = updates[0].message();
    await commiter.createCommit(repository, branch, message, updates);
  }

  if (!userToken) {
    console.log(
      "📣 Skipped the workflow files since we are not authorized to update them.",
    );
  }

  const header = options?.isTest ? "[TEST] " : "";
  const type = pullRequestType(updates);

  const title = deps.length > 1
    ? header + `${type}(deps): update dependencies`
    : header + updates[0].message();

  return await actor.createPullRequest(repository, branch, title, base);
}
