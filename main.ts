import { Command } from "https://deno.land/x/cliffy@v0.25.3/mod.ts";
import {
  createCommits,
  createPullRequest,
  getUpdates,
  VERSION,
} from "./mod.ts";

const { args, options } = await new Command()
  .name("denopendabot")
  .version(VERSION)
  .description("Keep your Deno project up-to-date.")
  .arguments("<repository:string>")
  .option(
    "--base <name>",
    "Branch to update.",
    { default: "main" },
  )
  .option(
    "--branch <name>",
    "Working branch.",
    { default: "denopendabot" },
  )
  .option(
    "-i --include <paths...>",
    "Specify files to update.",
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
    "-o --output <path>",
    "Output the results to a file.",
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
    "--test",
    "Run for testing.",
  )
  .option(
    "-t --token <token>",
    "Access token associated with GitHub Action.",
    { default: "GITHUB_TOKEN" },
  )
  .option(
    "-u --user-token <token>",
    "Private access token authorized to update workflows.",
  )
  .parse(Deno.args);

const repo = args[0];
const updates = await getUpdates(repo, options);

if (!updates.length) {
  console.log("🎉 Everything is up-to-date!");
}

if (options.output) {
  Deno.writeTextFileSync(options.output, JSON.stringify(updates));
}

if (options.check && updates.length) {
  Deno.exit(1);
}

if (options.dryRun) {
  Deno.exit(0);
}

await createCommits(repo, updates, options);
await createPullRequest(repo, options);

Deno.exit(0);
