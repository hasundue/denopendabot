import { Command } from "https://deno.land/x/cliffy@v0.25.2/mod.ts";
import { createPullRequest, VERSION } from "./mod.ts";

const { args, options } = await new Command()
  .name("denopendabot")
  .version(VERSION)
  .description("Keep your Deno project up-to-date.")
  .arguments("<repository:string>")
  .option(
    "--base <name>",
    "Branch to update. (default: main)",
  )
  .option(
    "--branch <name>",
    "Working branch. (default: denopendabot)",
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

Deno.exit(0);
