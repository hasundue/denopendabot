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
  .option(
    "-c --check",
    "Exit with code=1 if any update is found",
  )
  .option(
    "-d --dry-run",
    "Will not actually update",
  )
  .option(
    "-t --token <token>",
    "Private access token for the repository.",
  )
  .parse(Deno.args);

const repo = args[0];
const result = await createPullRequest(repo, options);

if (!options.dryRun && !result) {
  console.log("🎉 Everything is up-to-date!");
}

if (options.check && result) Deno.exit(1);

Deno.exit(0);
