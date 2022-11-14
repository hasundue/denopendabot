import { gt } from "https://deno.land/std@0.164.0/semver/mod.ts";
import { GitHubClient } from "./octokit.ts";
import { semverRegExp, Update, UpdateSpec } from "./common.ts";

export const regexp = (
  repo = "\\S+/\\S+",
  version = semverRegExp.source,
) =>
  RegExp(
    "(^.*[^v]|^)(" + version + ")(.+@denopendabot\\s+)(" + repo + ")($|\\s.*$)",
    "mg",
  );

export const versionRegExp = (
  repo: string,
  version = semverRegExp.source,
) =>
  RegExp(
    "(?<=^.*[^v]|^)" + version + "(?=.+@denopendabot\\s+" + repo +
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
  const ensuredGitHub = github ?? new GitHubClient();

  const matches = input.matchAll(regexp(release?.name));
  const specs: UpdateSpec[] = [];

  for (const match of matches) {
    const name = match[7];

    const initial = match[2];
    const target = (release?.name === name)
      ? release.target
      : await ensuredGitHub.getLatestRelease(name);

    if (target && gt(target, initial)) {
      console.debug(`💡 ${name} ${initial} => ${target}`);
      specs.push({ name, initial, target });
    }
  }

  return specs;
}
