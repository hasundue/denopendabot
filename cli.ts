import { Command } from "https://deno.land/x/cliffy@v0.25.7/mod.ts";
import { env } from "./mod/env.ts";
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
    "-b --base-branch <name>",
    "Branch to update.",
    { default: "main" },
  )
  .option(
    "-w --working-branch <name>",
    "Working branch.",
    { default: "denopendabot" },
  )
  .option(
    "--root <path:file>",
    "Path to the project root (not prefixed with './')",
  )
  .option(
    "-i --include <paths:file[]>",
    "Specify files to update.",
  )
  .option(
    "-x --exclude <paths:file[]>",
    "Files to exclude.",
    { separator: " " },
  )
  .option(
    "-l --labels <names:string[]>",
    "Labels for the pull request.",
    { separator: " " },
  )
  .option(
    "-r --release <target_version:string>",
    "Bump the repository version for a release.",
  )
  .option(
    "-d --dry-run",
    "Just check updates.",
  )
  .option(
    "-t --token <token:string>",
    "Access token associated with GitHub Action.",
    { default: "GITHUB_TOKEN" },
  )
  .option(
    "-u --user-token <token:string>",
    "Private access token authorized to update workflows.",
  )
  .parse(Deno.args);

const repo = args[0];
const updates = await getUpdates(repo, options);

if (!updates.length) {
  console.info("🎉 Everything is up-to-date!");
}

if (!options.dryRun) {
  await createCommits(repo, updates, options);
  await createPullRequest(repo, options);
}

if (env.CI) {
  await Deno.writeTextFile(env.GITHUB_OUTPUT!, "updated=true\n", {
    append: true,
  });
  console.log(`echo "updated=true" >> $GITHUB_OUTPUT`);
}
