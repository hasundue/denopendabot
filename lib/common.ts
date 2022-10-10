import { extname } from "https://deno.land/std@0.159.0/path/mod.ts";
export type UpdateSpec = {
  name: string;
  initial?: string;
  target: string;
};

export abstract class Update {
  path: string;
  spec: UpdateSpec;
  type: "build" | "ci" | "docs";

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

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
