import {
  gt,
  prerelease,
  valid,
} from "https://deno.land/std@0.159.0/semver/mod.ts";
import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.8.0/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.8.0/search.ts";
import {
  semverRegExp,
  Update as AbstractUpdate,
  UpdateSpec,
} from "./common.ts";

const nameToUrl = (name: string) => "https://" + name;
const urlToName = (url: string) =>
  url.match(RegExp("(?<=^https?://).*" + semverRegExp.source))![0];

export class Update extends AbstractUpdate {
  content = (input: string) => {
    const registry = lookup(nameToUrl(this.spec.name), REGISTRIES);
    if (!registry) {
      throw Error(`Module ${this.spec.name} not found in the registry`);
    }
    return input.replaceAll(
      this.spec.name,
      urlToName(registry.at(this.spec.target).url),
    );
  };
  message = () => {
    const { name, target } = this.spec;
    return `${this.type}(deps): bump ${name} to ${target}`;
  };
}

export async function getUpdateSpecs(
  input: string,
  release?: UpdateSpec,
): Promise<UpdateSpec[]> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const specs: UpdateSpec[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const name = urlToName(registry.url);
    const initial = registry.version();

    const latest = (release && name.includes(release.name))
      ? release.target
      : (await registry.all()).find((v) => !prerelease(v));

    if (valid(initial) && latest && gt(latest, initial)) {
      console.log(`💡 ${name} => ${latest}`);
      specs.push({ name, target: latest });
    }
  }

  return specs;
}
