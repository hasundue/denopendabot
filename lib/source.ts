import { getLatestRelease } from "./github.ts";
import { semverRegExp, UpdateSpec } from "./common.ts";

export async function update(
  input: string,
  repos: UpdateSpec[],
): Promise<string> {
  let output = input;

  for (const repo of repos) {
    const target = repo.target ?? await getLatestRelease(repo.specifier);

    if (target) {
      output = output.replace(
        RegExp(
          "(?<=.*)" + semverRegExp.source +
            "(?=.+@denopendabot\\s+" + repo.specifier + ")",
        ),
        target,
      );
    }
  }

  return output;
}
