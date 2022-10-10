export interface Repository {
  name: string;
  initial?: string;
  target?: string;
}

export interface Update {
  dep: string; // repository or module
  target: string; // target version
  initial?: string; // initial version
}

export interface UpdateSpec extends Update {
  path: string;
}

export interface UpdateContent extends UpdateSpec {
  content: string;
}

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
