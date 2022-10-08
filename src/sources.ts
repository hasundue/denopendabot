import { getLatestRelease } from "./github.ts";
import { Repository, semverRegExp } from "./common.ts";

export async function update(
  input: string,
  repos: Repository[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const latest = repo.latest ?? await getLatestRelease(repo.name);

    if (latest) {
      output = output.replace(
        RegExp(
          "(?<=.*)" + semverRegExp.source +
            "(?=.*@denopendabot " + repo.name + ")",
        ),
        latest,
      );
    }
  }

  return output;
}
