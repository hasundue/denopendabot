import { Command } from "cliffy/command/mod.ts";

import { Udd } from "udd/mod.ts";
import { importUrls } from "udd/search.ts";

import {
  defaultName,
  defaultVersion,
  lookup,
  REGISTRIES,
} from "udd/registry.ts";

import $ from "dax/mod.ts";

const { args, options } = await new Command()
  .name("denopendabot")
  .version("0.1.0")
  .description("Dependabot clone for Deno projects")
  .globalOption("-v, --verbose", "Enable logging.")
  .arguments("<files...>")
  .parse(Deno.args);

const files = args[0];
const modules: string[] = [];

for (const file of files) {
  const content = await Deno.readTextFile(file);
  importUrls(content, REGISTRIES).forEach((module) => modules.push(module));
}

if (options.verbose) console.log(modules);

const udds = files.map((file) => new Udd(file, { quiet: !options.verbose }));
const branch = await $`git branch --show-current`;

for (const module of modules) {
  const latest = lookup(module, REGISTRIES);

  if (latest) {
    const name = defaultName(latest);
    const version = defaultVersion(latest);
    await $`git checkout -b ${name}-${version}`;

    await Promise.all(udds.map((udd) => udd.update(latest)));

    const message = `build(deps): bump ${name} to ${version}`;
    await $`git commit -a -m "${message}"`;

    if (options.verbose) console.log();
  }
}

await $`git checkout ${branch}`;
