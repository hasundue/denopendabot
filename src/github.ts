import { Octokit } from "https://esm.sh/@octokit/core@4.0.5";

const octokit = new Octokit({
  auth: Deno.env.get("GITHUB_TOKEN") ?? Deno.env.get("GH_TOKEN"),
});

export async function getLatestRelease(
  repository: string,
): Promise<string | null> {
  const [owner, repo] = repository.split("/");
  try {
    const { data: release } = await octokit.request(
      "GET /repos/{owner}/{repo}/releases/latest",
      { owner, repo },
    );
    return release.tag_name;
  } catch {
    return null;
  }
}
