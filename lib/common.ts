import { extname } from "https://deno.land/std@0.159.0/path/mod.ts";
import { minOf } from "https://deno.land/std@0.159.0/collections/min_of.ts";

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

    const ext = extname(this.path);
    this.type = (ext === ".md")
      ? "docs"
      : (ext === ".yml" || ext === ".yaml")
      ? "ci"
      : "build";
  }

  abstract content: (input: string) => string;
  abstract message: () => string;
}

export const pullRequestType = (updates: Update[]): CommitType =>
  CommitType[
    minOf(
      updates,
      (update) => CommitType.findIndex((type) => type === update.type),
    )!
  ];
