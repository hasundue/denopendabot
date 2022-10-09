import { parse as parseYaml } from "https://deno.land/std@0.158.0/encoding/yaml.ts";
import { gt, valid } from "https://deno.land/std@0.158.0/semver/mod.ts";
import { getLatestRelease } from "./github.ts";
import { Repository, Update } from "./common.ts";

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

interface Action {
  name: string;
  with: string;
  repo: Repository;
}

export async function update(
  input: string,
  actions: Action[],
): Promise<Update[]> {
  const workflow = parseYaml(input) as Workflow;
  let output = input;
  const repos: Repository[] = [];

  for (const job of Object.values(workflow.jobs)) {
    for (const step of Object.values(job.steps)) {
      const action = actions.find((action) => step.uses?.match(action.name));

      if (action && step.with) {
        const initial = step.with[action.with];

        if (valid(initial)) {
          const target = action.repo.target ??
            await getLatestRelease(action.repo.name);

          if (target) {
            repos.push({ name: action.repo.name, initial, target });
          }

          if (target && gt(target, initial)) {
            output = output.replace(
              RegExp(`${action.with}: ` + `["']?` + initial + `["']?`),
              `${action.with}: ${target}`,
            );
          }
        }
      }
    }
  }

  return { output, repos };
}
