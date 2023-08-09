import { env } from "./env.ts";
import { octokit } from "./webhooks.ts";

type Brand<T, U> = T & { _type: U };

type GitHubDeployId = Brand<number, "GitHubDeployId">;
type DenoDeployId = Brand<string, "DenoDeployId">;
type DeployUrl = Brand<string, "DeployURL">;

const [owner, repo] = env.APP_REPO.split("/");

async function getDeployUrl(
  deployment_id: GitHubDeployId,
): Promise<DeployUrl | undefined> {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
    { owner, repo, deployment_id },
  );
  return data[0].environment_url as DeployUrl;
}

export function parseDeployId(url: string): DenoDeployId {
  const regexp = new RegExp(
    "(?<=https://denopendabot-)" + "[a-z0-9]{12}" + "(?=.deno.dev)",
  );
  const matched = regexp.exec(url);
  if (!matched) {
    throw new Error(`Invalid deployment URL: ${url}`);
  }
  return matched[0] as DenoDeployId;
}

const deployEnvs = [
  "Production",
  "Preview",
] as const;

export type DeployEnv = typeof deployEnvs[number];

const MAX_PAGES = 10 as const; // Just an ad-hoc number

export async function getDeployEnvUrl(
  env: DeployEnv,
): Promise<DeployUrl | undefined> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await octokit.request(
      "GET /repos/{owner}/{repo}/deployments",
      { owner, repo, page },
    );
    const data = res.data.filter((it) => it.environment === env)[0];
    if (data) {
      const url = await getDeployUrl(data.id as GitHubDeployId);
      if (!url) {
        throw new Error(
          `❗ Could not find an URL for the deployment ${data.id}`,
        );
      }
      return url;
    }
  }
  return undefined;
}

export async function getDeployId(env: DeployEnv): Promise<DenoDeployId> {
  const url = await getDeployEnvUrl(env);
  if (!url) {
    throw new Error(`❗ Could not find a ${env.toLowerCase()} deployment`);
  }
  return parseDeployId(url);
}

export async function getThisDeployEnv(): Promise<DeployEnv> {
  if (env.DENO_DEPLOYMENT_ID === await getDeployId("Production")) {
    return "Production";
  }
  return "Preview";
}
