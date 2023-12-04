import { distinct } from "https://deno.land/std@0.208.0/collections/distinct.ts";
import { format, gt } from "https://deno.land/std@0.208.0/semver/mod.ts";
import { tryParse } from "https://deno.land/std@0.208.0/semver/try_parse.ts";
import {
  defaultName,
  lookup,
  REGISTRIES,
  RegistryUrl,
} from "https://deno.land/x/udd@0.8.2/registry.ts";
import { importUrls } from "https://deno.land/x/udd@0.8.2/search.ts";
import { Update, UpdateSpec } from "./common.ts";

interface PackageInfo {
  parts: string[];
  scope: string;
  packageName: string;
  version: string;
}

function parseName(registry: RegistryUrl) {
  let name: string;
  try {
    // @ts-ignore use a method name() if exists
    name = registry.name() as string;
  } catch {
    try {
      // @ts-ignore use a method parts() if exists
      const { scope, packageName } = registry.parts() as PackageInfo;
      name = `${scope}/${packageName}`;
    } catch {
      name = defaultName(registry);
    }
  }
  if (!name) {
    throw new Error(`Could not find a module name for ${registry.url}`);
  }
  return name;
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

export type ModuleUpdateSpec = UpdateSpec & {
  url: string;
};

export async function getModuleUpdateSpecs(
  input: string,
  release?: UpdateSpec,
): Promise<ModuleUpdateSpec[]> {
  // We need distinct() for some reason
  const urls = distinct(importUrls(input, REGISTRIES));

  const registries = urls.map((url) => lookup(url, REGISTRIES));
  const specs: ModuleUpdateSpec[] = [];

  for (const registry of registries) {
    if (!registry) continue;

    const name = parseName(registry);
    if (!name) continue;
    if (release && !name.startsWith(release.name)) continue;

    const initial = tryParse(registry.version());
    const latest = release
      ? tryParse(release.target)
      : (await registry.all()).map((v) => tryParse(v)).find((v) =>
        !v?.prerelease.length
      );

    if (initial && latest && gt(latest, initial)) {
      console.debug(`💡 ${name} ${format(initial)} => ${format(latest)}`);
      specs.push({
        url: registry.url,
        name,
        initial: format(initial),
        target: format(latest),
      });
    }
  }

  return specs;
}
