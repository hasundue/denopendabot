export interface Repository {
  name: string;
  initial?: string;
  target?: string;
}

export type UpdateSpec = {
  dep: string;
  initial?: string;
  target: string;
};

export abstract class Update {
  path: string;
  spec: UpdateSpec;

  constructor(path: string, spec: UpdateSpec) {
    this.path = path;
    this.spec = spec;
  }

  abstract content: (input: string) => string;
  abstract message: () => string;
}

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
