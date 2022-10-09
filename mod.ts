import { Module, update as updateModule } from "./lib/module.ts";
import * as github from "./lib/github.ts";

export async function update(
  repo: string,
  options?: {
    branch?: string;
    module?: Module;
    sources?: string[];
  },
) {
  const base = options?.branch ?? "main";
  const tree = await github.getTree(repo, base);

  const targets = tree
    .filter((blob) => options?.sources?.find((it) => blob.path?.match(it)));

  for (const entry of targets) {
    if (!entry.sha) {
      console.warn(`A blob ${entry.path} does not have a SHA-1 value.`);
      continue;
    }
    const content = await github.getBlobContent(repo, entry.sha);
    const modules = options?.module && [options.module];

    const result = await updateModule(content, modules);
    console.log(result);
  }
}
