import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { createPullRequest } from "../mod.ts";
import { env } from "../lib/env.ts";
import { Client } from "../lib/github.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const initial = "0.5.3"; // @denopendabot hasundue/denopendabot
const target = "1.0.0";
const github = new Client(env.GITHUB_TOKEN);

Deno.test({
  name: "createPullRequest",
  ignore: !env.CI,
  fn: async () => {
    const branch = "test-" + Date.now().valueOf();

    await github.createBranch(repo, base);

    const result = await createPullRequest(repo, {
      branch,
      release: target,
      include: ["mod.ts"],
    });

    assert(result);

    assertEquals(
      result.title,
      `build(deps): bump hasundue/denopendabot from ${initial} to ${target}`,
    );

    await github.deleteBranch(repo, branch);
  },
});
