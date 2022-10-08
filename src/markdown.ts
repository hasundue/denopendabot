import { Repository } from "./actions.ts";

export function update(input: string, repos: Repository[]): string {
  let output = input;

  for (const repo of repos) {
    // update badges
    const regexp = RegExp(
      "(?<=!\\[" + repo.name + "\\]" + "\\(.*)" +
        repo.initial.replaceAll(".", "\\.") + "(?=.*\\))",
    );
    output = output.replace(regexp, repo.latest);
  }

  return output;
}
