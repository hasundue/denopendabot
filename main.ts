import { Command } from "https://deno.land/x/cliffy@v0.25.2/mod.ts";
import { update } from "./mod.ts";
import { Module } from "./lib/module.ts";

const { args, options } = await new Command()
  .name("denopendabot")
  .version("0.0.0") // @denopendabot hasundue/denopendabot
  .description("A command-line tool to keep your Deno repository up-to-date.")
  .arguments("<repository:string>")
  .option(
    "-b --branch <name>",
    "Branch to update. (default: main)",
  )
  .option(
    "-x --exclude <paths...>",
    "Files to exclude.",
  )
  .option(
    "-m --module <url> <target_version>",
    "TypeScript/JavaScript module to update.",
  )
  .option(
    "-s --sources <paths...>",
    "Files to update their dependent modules. (default: *)",
  )
  .option(
    "-w --workflows <paths...>",
    "GitHub workflows to update. (default: ./github/workflows/*.yml)",
  )
  .option(
    "-a --actions <paths...>",
    "GitHub actions to update.",
  )
  .option(
    "-d --documents <paths...>",
    "Markdown documenst to update. (default: *.md)",
  )
  .parse(Deno.args);

const repo = args[0];

await update(repo, options);

// const exclude = options.exclude?.map((glob) => globToRegExp(glob)) ?? [];

// const files = walkSync("./", {
//   includeDirs: false,
//   skip: exclude.concat([/.git/]),
// });

// type ModuleUpdate = {
//   file: string;
// } & Module.Result;

// let updates: ModuleUpdate[] = [];

// for (const file of files) {
//   const input = Deno.readTextFileSync(file.path);
//   const modules = options.module && [{
//     url: options.module[0],
//     target: options.module[1],
//   }];
//   const updated = await Module.update(input, modules);
//   updates = updates.concat(
//     updated.map((entry) => ({ file: file.path, ...entry })),
//   );
// }
