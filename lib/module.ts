import {
  gt,
  prerelease,
  valid,
} from "https://deno.land/std@0.159.0/semver/mod.ts";
import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.8.0/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.8.0/search.ts";
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
    const head = name.split("\s")[0];
    return `${this.type}(deps): bump ${head} to ${target}`;
  };
}

export function removeIgnore(input: string) {
  const fns = [
    // ignore sections in markdown (denopendabot-ignore-start/end)
    (input: string) => {
      const start = "<!\\-\\- denopendabot\\-ignore\\-start \\-\\->";
      const end = "<!\\-\\- denopendabot\\-ignore\\-end \\-\\->";
      const regexp = RegExp("^\\s*" + start + ".*" + end + "\\s*$", "gms");
      return input.replaceAll(regexp, "");
    },
    // ignore a single line (@denopendabot ignore)
    (input: string) => {
      const regexp = /^.*@denopendabot ignore.*$/gm;
      return input.replaceAll(regexp, "");
    },
  ];

  let output = input;
  fns.forEach((fn) => output = fn(output));

  return output;
}

export async function getUpdateSpecs(
  input: string,
  release?: UpdateSpec,
): Promise<UpdateSpec[]> {
  const updatable = removeIgnore(input);

  const urls = importUrls(updatable, REGISTRIES);
  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const specs: UpdateSpec[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const name = urlToName(registry.url);
    const initial = registry.version();

    const latest = (release && name.match(release.name.split("/")[1]))
      ? release.target
      : (await registry.all()).find((v) => !prerelease(v));

    if (valid(initial) && latest && gt(latest, initial)) {
      console.log(`💡 ${name} => ${latest}`);
      specs.push({ name, target: latest });
    }
  }

  return specs;
}
