import { VERSION } from "../mod.ts";
import { env } from "../mod/env.ts";
import { GitHubClient } from "../mod/octokit.ts";

const yaml = Deno.readTextFileSync("./action.yml");

Deno.writeTextFileSync(
  "./integration/action.yml",
  yaml.replace(`https://deno.land/x/denopendabot@${VERSION}`, "."),
);

const github = new GitHubClient({
  repository: env.GITHUB_REPOSITORY,
  token: env.GITHUB_TOKEN,
});

await github.createBranch("test-action");
