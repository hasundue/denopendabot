export interface Repository {
  name: string;
  initial?: string;
  target?: string;
}

export interface Update {
  repo: string; // repository or module
  target: string; // target version
  initial?: string; // initial version
}

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
