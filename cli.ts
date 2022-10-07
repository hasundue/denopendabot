import { Command } from "https://deno.land/x/cliffy@v0.24.3/mod.ts";

import { Udd } from "https://deno.land/x/udd@0.7.5/mod.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";

import {
  defaultName,
  defaultVersion,
  lookup,
  REGISTRIES,
} from "https://deno.land/x/udd@0.7.5/registry.ts";

import $ from "https://deno.land/x/dax@0.13.0/mod.ts";

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
    const branch = `${name}-${version}`;
    await $`git checkout -b ${branch}`;

    await Promise.all(udds.map((udd) => udd.update(latest)));

    const message = `build(deps): bump ${name} to ${version}`;
    await $`git commit -a -m "${message}"`;

    await $`git push -u origin ${branch}`;
    await $`gh pr create --title ${message}`;

    if (options.verbose) console.log();
  }
}

await $`git checkout ${branch}`;
