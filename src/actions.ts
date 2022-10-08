import { parse as parseYaml } from "https://deno.land/std@0.158.0/encoding/yaml.ts";
import { gt, valid } from "https://deno.land/std@0.158.0/semver/mod.ts";
import { getLatestRelease } from "./github.ts";

const ACTIONS = [
  {
    name: "denoland/setup-deno",
    with: "deno-version",
    repo: "denoland/deno",
  },
  {
    name: "actions/setup-node",
    with: "node-version",
    repo: "nodejs/node",
  },
] as const;

interface Workflow {
  jobs: {
    [name: string]: Job;
  };
  [x: string]: unknown;
}

interface Job {
  steps: {
    [name: string]: Step;
  };
}

interface Step {
  uses?: string;
  with?: Record<string, string>;
}

interface UpdateResult {
  output: string;
  repos: Repository[];
}

export interface Repository {
  name: string;
  initial: string;
  latest: string;
}

export async function update(input: string): Promise<UpdateResult> {
  const workflow = parseYaml(input) as Workflow;
  let output = input;
  const repos: Repository[] = [];

  for (const job of Object.values(workflow.jobs)) {
    for (const step of Object.values(job.steps)) {
      const action = ACTIONS.find((action) => step.uses?.match(action.name));

      if (action && step.with) {
        const initial = step.with[action.with];

        if (valid(initial)) {
          const latest = await getLatestRelease(action.repo);

          if (latest) {
            repos.push({ name: action.repo, initial, latest });
          }

          if (latest && gt(latest, initial)) {
            output = output.replace(
              `${action.with}: ${initial}`,
              `${action.with}: ${latest}`,
            );
          }
        }
      }
    }
  }

  return { output, repos };
}
