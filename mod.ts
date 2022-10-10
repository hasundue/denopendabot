import { groupBy } from "https://deno.land/std@0.159.0/collections/group_by.ts";
import { checkUpdate, getContent } from "./lib/module.ts";
import { Update, UpdateContent, UpdateSpec } from "./lib/common.ts";
import * as github from "./lib/github.ts";

export async function update(
  repo: string,
  options?: {
    branch?: string;
    modules?: Update[];
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

  const specs: UpdateSpec[] = [];

  for (const entry of targets) {
    const content = await github.getBlobContent(repo, entry.sha!);
    const updates = options?.modules || await checkUpdate(content);

    specs.concat(updates.map((it) => ({ ...it, path: entry.path! })));
  }

  if (!specs) {
    console.log("No updates found.");
    return;
  }

  await github.ensureBranch(repo, "denopendabot", base);

  const groupsByDep = groupBy(specs, (it) => it.dep);
  const deps = Object.keys(groupsByDep);

  for (const dep of deps) {
    const specs = groupsByDep[dep]!;
    const contents: UpdateContent[] = [];

    for (const spec of specs) {
      const content = await getContent(input, spec);
      contents.push({ ...spec, content });
    }
  }
}
