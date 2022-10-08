import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.7.5/registry.ts";
import { gt, valid } from "https://deno.land/std@0.159.0/semver/mod.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";

interface Module {
  url: string | RegExp;
  initial?: string;
  target?: string;
}

export interface Result extends Module {
  output: string;
}

export async function update(
  input: string,
  modules?: Module[],
): Promise<Result[]> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((module) => lookup(module, REGISTRIES));
  const results: Result[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const module = modules &&
      modules.find((target) => registry.url.match(target.url));

    if (!modules || module) {
      const target = module?.target ?? (await registry.all())[0];
      const initial = registry.version();

      if (valid(target) && valid(initial) && gt(target, initial)) {
        results.push({
          url: registry.url,
          initial,
          target,
          output: input.replace(registry.url, registry.at(target).url),
        });
      }
    }
  }

  return results;
}
