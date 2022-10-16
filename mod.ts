import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { intersect } from "https://deno.land/std@0.159.0/collections/intersect.ts";
import { withoutAll } from "https://deno.land/std@0.159.0/collections/without_all.ts";
import { env } from "./lib/env.ts";
import { pullRequestType, removeIgnore, Update } from "./lib/common.ts";
import { Client } from "./lib/github.ts";
import { getModuleUpdateSpecs, ModuleUpdate } from "./lib/module.ts";
import { getRepoUpdateSpecs, RepoUpdate } from "./lib/repo.ts";

export const VERSION = "0.6.2"; // @denopendabot hasundue/denopendabot

interface Options {
  base?: string;
  branch?: string;
  release?: string;
  include?: string[];
  exclude?: string[];
  dryRun?: true;
  token?: string;
  userToken?: string;
  test?: boolean;
}

export async function createPullRequest(
  repository: string,
  options?: Options,
) {
  const envToken = options?.token && env.get(options?.token);
  const rawToken = !envToken ? options?.token : undefined;
  const actionToken = (envToken || rawToken) ?? env.GITHUB_TOKEN;
  if (!actionToken) {
    console.log("📣 Access token not provided. Switch to dry-run mode.");
  }
  // github client to run the workflow
  const actor = new Client(actionToken);

  const version = await actor.getLatestRelease(repository);

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

  // name of the released module of this repository
  const moduleName = repository.split("/")[1].replaceAll("-", "_");

  for (const blob of blobs) {
    console.log(`🔍 ${blob.path}`);

    const content = await actor.getBlobContent(repository, blob.sha!);
    const contentToUpdate = removeIgnore(content);

    // TS/JS modules
    const moduleSpecs = options?.release
      ? [{
        url: `https://deno.land/x/${moduleName}`,
        name: `deno.land/x/${moduleName}`,
        initial: version,
        target: options.release,
      }]
      : await getModuleUpdateSpecs(contentToUpdate);

    moduleSpecs.forEach((spec) =>
      updates.push(new ModuleUpdate(blob.path!, spec))
    );

    // other repositories
    const repoSpecs = options?.release
      ? [{ name: repository, initial: version, target: options.release }]
      : await getRepoUpdateSpecs(actor, contentToUpdate);

    repoSpecs.forEach((spec) => updates.push(new RepoUpdate(blob.path!, spec)));
  }

  // no updates found or a dry-run
  if (!updates.length || options?.dryRun) return null;

  // check if we are authoried to update workflows
  const envUserToken = options?.userToken && env.get(options?.userToken);
  const rawUserToken = !envUserToken ? options?.userToken : undefined;
  const userToken = envUserToken || rawUserToken;

  // filter out workflows if we are not authorized to update them
  const updatables = !userToken
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

  // create a title
  let title = options?.test ? "[TEST] " : "";

  if (options?.release) {
    title += "build(version): bump the version";
    title += version ? ` from ${version}` : "";
    title += ` to ${updates[0].spec.target}`;
  } else {
    if (deps.length > 1) {
      const type = pullRequestType(updates);
      title += `${type}(deps): update dependencies`;
    } else {
      title += updates[0].message();
    }
  }

  return await actor.createPullRequest(repository, branch, title, base);
}
