import { gt } from "https://deno.land/std@0.159.0/semver/mod.ts";
import { getLatestRelease } from "./github.ts";
import {
  semverRegExp,
  Update as AbstractUpdate,
  UpdateSpec,
} from "./common.ts";

export const regexp = (
  repo = "\\S+/\\S+",
  version = semverRegExp.source,
) =>
  RegExp(
    "(^.*\\W|^)(" + version + ")(\\W+@denopendabot\\s+)(" + repo +
      ")($|\\s.*$)",
    "mg",
  );

export const versionRegExp = (
  repo: string,
  version = semverRegExp.source,
) =>
  RegExp(
    "(?<=^.*\\W|^)" + version + "(?=\\W+@denopendabot\\s+" + repo +
      "($|\\s.*$))",
    "mg",
  );

export class Update extends AbstractUpdate {
  content = (input: string) =>
    input.replaceAll(
      versionRegExp(this.spec.name, this.spec.initial),
      this.spec.target,
    );
  message = () => {
    const { name, initial, target } = this.spec;
    return `${this.type}(deps): bump ${name} from ${initial} to ${target}`;
  };
}

export async function getUpdateSpecs(
  input: string,
): Promise<UpdateSpec[]> {
  const matches = input.matchAll(regexp());
  const specs: UpdateSpec[] = [];

  for (const match of matches) {
    const name = match[7];

    const initial = match[2];
    const latest = await getLatestRelease(name);

    if (latest && gt(latest, initial)) {
      specs.push({ name, initial, target: latest });
    }
  }

  return specs;
}
