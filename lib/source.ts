import { getLatestRelease } from "./github.ts";
import { Repository, semverRegExp } from "./common.ts";

export async function update(
  input: string,
  repos: Repository[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const target = repo.target ?? await getLatestRelease(repo.specifier);

    if (target) {
      output = output.replace(
        RegExp(
          "(?<=.*)" + semverRegExp.source +
            "(?=.*@denopendabot " + repo.specifier + ")",
        ),
        target,
      );
    }
  }

  return output;
}
