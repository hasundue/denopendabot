import { parse as parseYaml } from "https://deno.land/std@0.158.0/encoding/yaml.ts";
import { gt, valid } from "https://deno.land/std@0.158.0/semver/mod.ts";
import { getLatestRelease } from "./github.ts";
import { Repository } from "./common.ts";

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

interface Action {
  name: string;
  with: string;
  repo: Repository;
}

export async function update(
  input: string,
  actions: Action[],
): Promise<UpdateResult> {
  const workflow = parseYaml(input) as Workflow;
  let output = input;
  const repos: Repository[] = [];

  for (const job of Object.values(workflow.jobs)) {
    for (const step of Object.values(job.steps)) {
      const action = actions.find((action) => step.uses?.match(action.name));

      if (action && step.with) {
        const initial = step.with[action.with];

        if (valid(initial)) {
          const latest = action.repo.latest ??
            await getLatestRelease(action.repo.name);

          if (latest) {
            repos.push({ name: action.repo.name, initial, latest });
          }

          if (latest && gt(latest, initial)) {
            output = output.replace(
              RegExp(`${action.with}: ` + `["']?` + initial + `["']?`),
              `${action.with}: ${latest}`,
            );
          }
        }
      }
    }
  }

  return { output, repos };
}
