import * as semver from "./semver.ts";
import { getLatestRelease } from "./github.ts";

interface Repository {
  name: string;
  latest?: string;
}

export async function update(
  input: string,
  repos: Repository[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const latest = repo.latest ?? await getLatestRelease(repo.name);

    if (latest) {
      // update badges
      const regexp = RegExp(
        "(?<=!\\[" + repo.name + "\\]" + "\\(.*)" +
          semver.regex.source + "(?=.*\\))",
      );
      output = output.replace(regexp, latest);
    }
  }

  return output;
}
