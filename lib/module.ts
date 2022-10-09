import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.7.5/registry.ts";
import { gt, valid } from "https://deno.land/std@0.159.0/semver/mod.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";
import { Update } from "./common.ts";

export interface Module {
  url: string | RegExp;
  target?: string;
}

export interface Result extends Required<Module> {
  content: string;
}

export async function checkUpdate(
  input: string,
): Promise<Update[]> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const updates: Update[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const initial = registry.version();
    const latest = (await registry.all())[0];

    if (valid(latest) && valid(initial) && gt(latest, initial)) {
      updates.push({
        repo: registry.url,
        target: latest,
      });
    }
  }

  return updates;
}

export async function getContent(
  input: string,
  update: Update,
): Promise<string> {
  const registry = lookup(update.repo, REGISTRIES);

  if (!registry) {
    throw Error(`Module ${update.repo} not found in the registry`);
  }
  return input.replace(update.repo, registry.at(update.target).url);
}
