import { parse as parseYaml } from "https://deno.land/std@0.158.0/encoding/yaml.ts";
import { gt, valid } from "https://deno.land/std@0.158.0/semver/mod.ts";
import {
  semverRegExp,
  Update as AbstractUpdate,
  UpdateSpec,
} from "./common.ts";
import { getLatestRelease } from "./github.ts";

interface Workflow {
  jobs: {
    [name: string]: Job;
  };
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
  repo: UpdateSpec;
}

export class Update extends AbstractUpdate {
  content = (input: string) => {
    return input.replace(semverRegExp, this.spec.target);
  };
}

export async function getUpdateSpecs(
  input: string,
  actions: Action[],
): Promise<UpdateSpec[]> {
  const workflow = parseYaml(input) as Workflow;
  const specs: UpdateSpec[] = [];

  for (const job of Object.values(workflow.jobs)) {
    for (const step of Object.values(job.steps)) {
      const action = actions.find((action) => step.uses?.match(action.name));

      if (action && step.with) {
        const initial = step.with[action.with];

        if (valid(initial)) {
          const target = action.repo.target ??
            await getLatestRelease(action.repo.name);

          if (target && gt(target, initial)) {
            repos.push({ name: action.repo.name, initial, target });
          }
        }
      }
    }
  }

  return { output, repos };
}
