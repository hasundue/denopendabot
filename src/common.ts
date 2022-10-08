export interface Repository {
  name: string;
  initial?: string;
  target?: string;
}

export const semverRegExp = /v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
