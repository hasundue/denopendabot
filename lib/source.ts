import { getLatestRelease } from "./github.ts";
import { Repository, semverRegExp } from "./common.ts";

export async function update(
  input: string,
  repos: Repository[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const target = repo.target ?? await getLatestRelease(repo.name);

    if (target) {
      output = output.replace(
        RegExp(
          "(?<=.*)" + semverRegExp.source +
            "(?=.*@denopendabot " + repo.name + ")",
        ),
        target,
      );
    }
  }

  return output;
}
