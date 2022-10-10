import { dirname } from "https://deno.land/std@0.159.0/path/mod.ts";
import { gt, valid } from "https://deno.land/std@0.159.0/semver/mod.ts";
import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.7.5/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";
import { Update as AbstractUpdate, UpdateSpec } from "./common.ts";

export class Update extends AbstractUpdate {
  content = (input: string) => {
    const registry = lookup(this.spec.dep, REGISTRIES);
    if (!registry) {
      throw Error(`Module ${this.spec.dep} not found in the registry`);
    }
    return input.replace(this.spec.dep, registry.at(this.spec.target).url);
  };
  message = () => {
    const name = dirname(this.spec.dep.toString().replace("https://", ""));
    return `build(deps): bump ${name} to ${this.spec.target}`;
  };
}

export async function getUpdateSpecs(
  input: string,
): Promise<UpdateSpec[]> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const specs: UpdateSpec[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const initial = registry.version();
    const latest = (await registry.all())[0];

    if (valid(latest) && valid(initial) && gt(latest, initial)) {
      specs.push({ dep: registry.url, target: latest });
    }
  }

  return specs;
}
