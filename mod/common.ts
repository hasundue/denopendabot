import { extname } from "https://deno.land/std@0.173.0/path/mod.ts";
import { minOf } from "https://deno.land/std@0.173.0/collections/min_of.ts";

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;

export const CommitType = [
  "build",
  "ci",
  "docs",
] as const;

export type CommitType = typeof CommitType[number];

export type UpdateSpec = {
  name: string;
  initial?: string;
  target: string;
};

export abstract class Update {
  path: string;
  spec: UpdateSpec;
  type: CommitType;

  constructor(path: string, spec: UpdateSpec) {
    this.path = path;
    this.spec = spec;

    this.type = this.isDocument() ? "docs" : this.isWorkflow() ? "ci" : "build";
  }

  isDocument = () => extname(this.path).match(/\.md|\.txt/) !== null;
  isWorkflow = () => this.path.startsWith(".github/workflows/");

  message = () => {
    const { name, initial, target } = this.spec;
    const str = initial ? ` from ${initial} ` : " ";
    return `${this.type}(deps): bump ${name}` + str + `to ${target}`;
  };

  abstract content: (input: string) => string;
}

export const pullRequestType = (types: CommitType[]): CommitType =>
  CommitType[
    minOf(
      types,
      (type) => CommitType.findIndex((it) => it === type),
    )!
  ];

export function removeIgnore(input: string) {
  const fns = [
    // ignore sections in typescript code (denopendabot-ignore-start/end)
    (input: string) => {
      const start = "// @denopendabot ignore\\-start";
      const end = "// @denopendabot ignore\\-end";
      const regexp = RegExp("^\\s*" + start + ".*" + end + "\\s*$", "gms");
      return input.replaceAll(regexp, "");
    },
    // ignore sections in markdown (denopendabot-ignore-start/end)
    (input: string) => {
      const start = "<!\\-\\- @denopendabot ignore\\-start \\-\\->";
      const end = "<!\\-\\- @denopendabot ignore\\-end \\-\\->";
      const regexp = RegExp("^\\s*" + start + ".*" + end + "\\s*$", "gms");
      return input.replaceAll(regexp, "");
    },
    // ignore a single line (@denopendabot ignore)
    (input: string) => {
      const regexp = /^.*@denopendabot ignore.*$/gm;
      return input.replaceAll(regexp, "");
    },
  ];

  let output = input;
  fns.forEach((fn) => output = fn(output));

  return output;
}
