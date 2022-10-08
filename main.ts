import { Command } from "https://deno.land/x/cliffy@v0.25.2/mod.ts";

import { Udd } from "https://deno.land/x/udd@0.7.5/mod.ts";
import { importUrls } from "https://deno.land/x/udd@0.7.5/search.ts";

import {
  defaultName,
  lookup,
  REGISTRIES,
} from "https://deno.land/x/udd@0.7.5/registry.ts";

import $ from "https://deno.land/x/dax@0.13.0/mod.ts";

const { args: files, options } = await new Command()
  .name("denopendabot")
  .version("0.1.0") // @denopendabot hasundue/denopendabot
  .description("A script to keep your Deno projects up-to-date.")
  .globalOption("-v, --verbose", "Enable logging.")
  .arguments("<files...>")
  .parse(Deno.args);

const modules: string[] = [];

await $`git config --global user.email "denopendabot@gmail.com"`;
await $`git config --global user.name "denopendabot"`;

for (const file of files) {
  const content = await Deno.readTextFile(file);
  importUrls(content, REGISTRIES).forEach((module) => modules.push(module));
}

if (options.verbose) console.log(modules);

const udds = files.map((file) => new Udd(file, { quiet: !options.verbose }));
const branch = await $`git branch --show-current`;

try {
  for (const module of modules) {
    const latest = lookup(module, REGISTRIES);

    if (latest) {
      const name = defaultName(latest);
      await $`git checkout -b denopendabot/${name}`;

      const results = await Promise.all(udds.map((udd) => udd.update(latest)));
      const message = "build(deps): " + results[0].message;

      await $`git commit -a -m "${message}"`;

      await $`git push -u origin ${branch}`;
      await $`gh pr create --title ${message}`;

      if (options.verbose) console.log();
    }
  }
} finally {
  await $`git checkout ${branch}`;
}
