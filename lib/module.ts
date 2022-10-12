import {
  gt,
  prerelease,
  valid,
} from "https://deno.land/std@0.159.0/semver/mod.ts";
import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.8.0/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";
import { Update as AbstractUpdate, UpdateSpec } from "./common.ts";

const nameToUrl = (name: string) => "https://" + name;
const urlToName = (url: string) => url.replace("https://", "");

export class Update extends AbstractUpdate {
  content = (input: string) => {
    const registry = lookup(nameToUrl(this.spec.name), REGISTRIES);
    if (!registry) {
      throw Error(`Module ${this.spec.name} not found in the registry`);
    }
    return input.replace(
      nameToUrl(this.spec.name),
      registry.at(this.spec.target).url,
    );
  };
  message = () => {
    const { name, target } = this.spec;
    const head = name.split("\n")[0];
    return `${this.type}(deps): bump ${head} to ${target}`;
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

    const name = urlToName(registry.url);
    const initial = registry.version();
    const all = await registry.all();

    // we try to ignore pre-releases
    const latest = all.find((v) => !prerelease(v));

    if (valid(initial) && latest && gt(latest, initial)) {
      console.log(`💡 ${name} => ${latest}`);
      specs.push({ name, target: latest });
    }
  }

  return specs;
}
