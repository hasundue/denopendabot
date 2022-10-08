import { Repository } from "./actions.ts";

export function update(input: string, repos: Repository[]): string {
  let output = input;

  for (const repo of repos) {
    const regexp = RegExp(
      "(?<=!\\[" + repo.name + "\\]" + "\\(.*)" +
        repo.initial.replaceAll(".", "\\.") + "(?=.*\\))",
      "g",
    );
    output = output.replaceAll(regexp, repo.latest);
  }

  return output;
}
