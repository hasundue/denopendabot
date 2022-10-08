import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.7.5/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";

interface Module {
  url: string;
  initial?: string;
  latest?: string;
}

interface Result {
  output: string;
  modules: Module[];
}

export async function update(
  input: string,
  targets?: Module[],
): Promise<Result> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((module) => lookup(module, REGISTRIES));

  let output = input;
  const results: Module[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const target = targets &&
      targets.find((target) => registry.url.match(target.url));

    if (!targets || target) {
      const latest = target?.latest ?? (await registry.all())[0];

      results.push({
        url: registry.url,
        initial: registry.version(),
        latest: latest,
      });

      output = output.replace(registry.url, registry.at(latest).url);
    }
  }

  return { output, modules: results };
}
