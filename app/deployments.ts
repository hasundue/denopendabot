import { env } from "./env.ts";
import { octokit } from "./webhooks.ts";

const [owner, repo] = env.APP_REPO.split("/");

const getURL = async (deployment_id: number) => {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses",
    { owner, repo, deployment_id },
  );
  return data[0].environment_url;
};

export const parseID = (url: string) => {
  const regexp = new RegExp(
    "(?<=https://denopendabot-)" + "[a-z0-9]{12}" + "(?=.deno.dev)",
  );
  const matched = regexp.exec(url);
  if (!matched) {
    throw new Error(`Invalid deployment URL: ${url}`);
  }
  return matched[0];
};

export const getDeployments = async () => {
  const res = await octokit.request(
    "GET /repos/{owner}/{repo}/deployments",
    { owner, repo },
  );
  if (!res) {
    throw new Error(
      `❗ Could not obtain deployments information from ${owner}/${repo}`,
    );
  }
  const data = {
    production: res.data.filter((it) => it.environment === "Production")[0],
    staging: res.data.filter((it) => it.environment === "Preview")[0],
  };
  const url = {
    production: await getURL(data.production.id),
    staging: await getURL(data.staging.id),
  };
  if (!url.production || !url.staging) {
    throw new Error("Production or staging deployment not found");
  }
  const id = {
    production: parseID(url.production),
    staging: parseID(url.staging),
  };
  return {
    production: {
      id: id.production,
      url: url.production,
    },
    staging: {
      id: id.staging,
      url: url.staging,
    },
  };
};

export type Deployment = "production" | "staging" | "preview";

export const deployment = async (): Promise<Deployment> => {
  const id = env["DENO_DEPLOYMENT_ID"];
  const deployments = await getDeployments();

  if (id === deployments.production.id) {
    return "production";
  } else if (id === deployments.staging.id) {
    return "staging";
  } else {
    return "preview";
  }
};

export const location = async (deploy: "production" | "staging") => {
  const deployments = await getDeployments();
  return deployments[deploy].url;
};
