import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { getInstallationId, getOctokit } from "./app.ts";

const repo = "hasundue/denopendabot";

Deno.test("getInstallationId", async () => {
  const id = await getInstallationId(repo);
  assertEquals(id, 29950034);
});

Deno.test("getOctokit", async () => {
  const octokit = await getOctokit(repo);
  assert(octokit);
});
