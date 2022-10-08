import * as semver from "./semver.ts";
import { getLatestRelease } from "./github.ts";
import { Repository } from "./repository.ts";

export async function update(
  input: string,
  repos: Repository[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const latest = repo.latest ?? await getLatestRelease(repo.name);

    if (latest) {
      // update a badge
      output = output.replace(
        RegExp(
          "(?<=!\\[" + repo.name + "\\]" + "\\(.*)" +
            semver.regex.source + "(?=.*\\))",
        ),
        latest,
      );
    }
  }

  return output;
}
