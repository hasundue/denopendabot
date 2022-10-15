import {
  gt,
  prerelease,
  valid,
} from "https://deno.land/std@0.159.0/semver/mod.ts";
import { lookup, REGISTRIES } from "https://deno.land/x/udd@0.8.0/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.8.0/search.ts";
import { semverRegExp, Update, UpdateSpec } from "./common.ts";

function parseUrl(url: string): { name: string; version: string } {
  const regexp = RegExp(
    "(?<=^https?://)(\\S+)@(" + semverRegExp.source + ")?",
  );
  const match = url.match(regexp);
  if (!match) throw Error(`Invalid url: ${url}`);
  return { name: match[1], version: match[2] };
}

export class ModuleUpdate extends Update {
  declare spec: ModuleUpdateSpec;

  constructor(path: string, spec: ModuleUpdateSpec) {
    super(path, spec);
  }

  content = (input: string) => {
    const { url, name, target } = this.spec;
    const registry = lookup(url, REGISTRIES);
    if (!registry) {
      throw Error(`Module ${name} not found in the registry`);
    }
    return input.replaceAll(url, registry.at(target).url);
  };
}

type ModuleUpdateSpec = UpdateSpec & {
  url: string;
};

export async function getModuleUpdateSpecs(
  input: string,
  release?: UpdateSpec,
): Promise<ModuleUpdateSpec[]> {
  const urls = importUrls(input, REGISTRIES);
  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const specs: ModuleUpdateSpec[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const { name, version: initial } = parseUrl(registry.url);

    const latest = (release && name.includes(release.name))
      ? release.target
      : (await registry.all()).find((v) => !prerelease(v));

    if (valid(initial) && latest && gt(latest, initial)) {
      console.log(`💡 ${name} ${initial} => ${latest}`);
      specs.push({ url: registry.url, name, initial, target: latest });
    }
  }

  return specs;
}
