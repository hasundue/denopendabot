import {
  assert,
  assertArrayIncludes,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { createPullRequest, getBlobsToUpdate } from "../mod.ts";
import { Client } from "../lib/github.ts";

const repo = "hasundue/denopendabot-test";
const base = "test";
const target = "0.7.5";
const github = new Client();

Deno.test("getBlobsToUpdate", async () => {
  const blobs = await getBlobsToUpdate(github, repo, {
    include: ["LICENSE", "README.md", "deps.ts"],
    exclude: ["LICENSE"],
  });
  const paths = blobs.map((blob) => blob.path);
  assertArrayIncludes(paths, ["deps.ts", "README.md"]);
});

Deno.test("createPullRequest", async () => {
  const branch = "test-" + Date.now().valueOf();

  await github.createBranch(repo, base);

  const result = await createPullRequest(repo, {
    branch,
    release: target,
    include: ["deps.ts"],
  });

  assert(result);

  assertEquals(
    result.title,
    `build(deps): bump deno.land/x/udd@0.7.4/mod.ts to ${target}`,
  );

  await github.deleteBranch(repo, branch);
});
