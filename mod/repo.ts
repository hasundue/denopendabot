import { gt } from "https://deno.land/std@0.173.0/semver/mod.ts";
import { GitHubClient } from "./octokit.ts";
import { semverRegExp, Update, UpdateSpec } from "./common.ts";
import { env } from "./env.ts";

export const regexp = (
  repo = "\\S+/\\S+",
  version = semverRegExp.source,
) =>
  RegExp(
    "(" + version + ")(.+@denopendabot\\s+)(" + repo + ")($|\\s.*$)",
    "mg",
  );

export const versionRegExp = (
  repo: string,
  version = semverRegExp.source,
) =>
  RegExp(
    "(" + version + ")(?=.+@denopendabot\\s+" + repo +
      "($|\\s.*$))",
    "mg",
  );

export class RepoUpdate extends Update {
  content = (input: string) =>
    input.replaceAll(
      versionRegExp(this.spec.name, this.spec.initial),
      this.spec.target,
    );
}

export async function getRepoUpdateSpecs(
  input: string,
  release?: UpdateSpec,
  github?: GitHubClient,
): Promise<UpdateSpec[]> {
  const ensuredGitHub = github ?? new GitHubClient({ token: env.GITHUB_TOKEN });

  const matches = input.matchAll(regexp(release?.name));
  const specs: UpdateSpec[] = [];

  for (const match of matches) {
    const name = match[6];

    const initial = match[1];
    const target = (release?.name === name)
      ? release.target
      : await ensuredGitHub.getLatestRelease(name);
    const semver = semverRegExp.exec(target ?? "");

    if (target && semver && gt(semver[0], initial)) {
      console.debug(`💡 ${name} ${initial} => ${semver[0]}`);
      specs.push({ name, initial, target: semver[0] });
    }
  }

  return specs;
}
