import { Command } from "https://deno.land/x/cliffy@v0.25.2/mod.ts";
import { globToRegExp } from "https://deno.land/std@0.159.0/path/glob.ts";
import { groupBy } from "https://deno.land/std@0.159.0/collections/mod.ts";
import { walkSync } from "https://deno.land/std@0.159.0/fs/mod.ts";
import * as Module from "./src/module.ts";

const { options } = await new Command()
  .name("denopendabot")
  .version("0.1.0") // @denopendabot hasundue/denopendabot
  .description("A script and library to keep your Deno projects up-to-date.")
  .option("-x --exclude <...globs>", "Files to exclude.")
  .option("-s --sources <...paths>", "Files to update modules.")
  .option(
    "-m --module <url> <version>",
    "Update a TypeScript/JavaScript modules to a specified version.",
  )
  .option(
    "-w --workflows <paths>",
    "GitHub workflowsa to update.",
    {
      default: "./github/workflows/*.{yml,yaml}",
    },
  )
  .option(
    "-d --documents <paths>",
    "Markdown documenst to update.",
    {
      default: "*.md",
    },
  )
  .parse(Deno.args);

const exclude = options.exclude?.map((glob) => globToRegExp(glob)) ?? [];

const files = walkSync("./", {
  includeDirs: false,
  skip: exclude.concat([/.git/]),
});

type Result = {
  file: string;
} & Module.Result;

let results: Result[] = [];

for (const file of files) {
  const input = Deno.readTextFileSync(file.path);
  const modules = options.module && [{
    url: options.module[0],
    target: options.module[1],
  }];
  const updated = await Module.update(input, modules);
  results = results.concat(
    updated.map((entry) => ({ file: file.path, ...entry })),
  );
}

const grouped = groupBy(results, (it) => it.url.toString());
console.log(grouped);
