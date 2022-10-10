import { Command } from "https://deno.land/x/cliffy@v0.25.2/mod.ts";
import { createPullRequest } from "./mod.ts";

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
    "-i --include <paths...>",
    "Files to update. (default: all files)",
  )
  .option(
    "-x --exclude <paths...>",
    "Files to exclude.",
  )
  .option(
    "-r --release <target_version>",
    "Bump the repository version for a release.",
  )
  .parse(Deno.args);

const repo = args[0];

await createPullRequest(repo, options);

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
