import { assertEquals } from "https://deno.land/std@0.160.0/testing/asserts.ts";
import { GitHubClient } from "./octokit.ts";
import { UpdateSpec } from "./common.ts";
import {
  getRepoUpdateSpecs,
  regexp,
  RepoUpdate,
  versionRegExp,
} from "./repo.ts";

const github = new GitHubClient();
const repo = "denoland/deno";
const initial = "v1.26.0";
const target = "v1.27.0"; // @denopendabot denoland/deno
const content = (version = initial) => `
deno version: ${version} <!-- @denopendabot ${repo} -->
deno_std version: 0.158.0 <!-- @denopendabot ${repo}_std -->
`;

Deno.test("regexp", () => {
  const matches = Array.from(content().matchAll(regexp()));
  assertEquals(matches.length, 2);
  assertEquals(matches[0][2], initial);
  assertEquals(matches[0][7], repo);
});

Deno.test("versionRegExp", () => {
  const matches = Array.from(
    content().matchAll(
      versionRegExp(repo),
    ),
  );
  assertEquals(matches.length, 1);
  assertEquals(matches[0][0], initial);
});

Deno.test("getUpdateSpecs", async () => {
  const specs = await getRepoUpdateSpecs(github, content());
  assertEquals(specs.length, 2);
  assertEquals(specs[0].name, repo);
  assertEquals(specs[0].initial, initial);
  assertEquals(specs[1].name, "denoland/deno_std");
  assertEquals(specs[1].initial, "0.158.0");
});

Deno.test("getUpdateSpecs (release)", async () => {
  const specs = await getRepoUpdateSpecs(github, content(), {
    name: repo,
    target,
  });
  assertEquals(specs.length, 1);
  assertEquals(specs[0].name, repo);
  assertEquals(specs[0].initial, initial);
  assertEquals(specs[0].target, target);
});

Deno.test("Update.content", () => {
  const spec: UpdateSpec = { name: repo, target };
  const update = new RepoUpdate("README.md", spec);
  assertEquals(
    update.content(content()),
    content(target),
  );
});
