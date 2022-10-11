import {
  assert,
  assertArrayIncludes,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { createPullRequest, getBlobsToUpdate, VERSION } from "../mod.ts";
import { getOctokit } from "../lib/app.ts";
import { Client } from "../lib/github.ts";

const repo = "hasundue/denopendabot";
const target = "1.0.0";
const github = new Client(await getOctokit(repo));

Deno.test("getBlobsToUpdate", async () => {
  const blobs = await getBlobsToUpdate(repo, {
    include: ["main.ts", "mod.ts", "app.ts", "README.md"],
    exclude: ["app.ts"],
  });
  const paths = blobs.map((blob) => blob.path);
  assertArrayIncludes(paths, ["main.ts", "mod.ts", "README.md"]);
});

Deno.test("createPullRequest", async () => {
  const branch = "test-" + Date.now().valueOf();

  const result = await createPullRequest(repo, {
    branch,
    release: target,
    include: ["mod.ts"],
  });

  assert(result);

  assertEquals(
    result.title,
    `build(deps): bump hasundue/denopendabot from ${VERSION} to ${target}`,
  );

  await github.deleteBranch(repo, branch);
});
