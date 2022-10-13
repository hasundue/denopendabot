import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { env } from "./env.ts";
import { Client } from "./github.ts";
import { Update } from "./repo.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const github = new Client(env.GITHUB_TOKEN);

Deno.test("getLatestRelease", async () => {
  const tag = await github.getLatestRelease(repo);
  assert(tag);
});

Deno.test("getBranch", async () => {
  const branch = await github.getBranch(repo, "main");
  assert(branch);
  assertEquals(branch.name, "main");
});

Deno.test("getCommit", async () => {
  const commit = await github.getCommit(repo, "main");
  assert(commit);
});

Deno.test({
  name: "createBranch",
  ignore: !env.CI,
  fn: async () => {
    const result = await github.createBranch(repo, base);
    assert(result);
  },
});

Deno.test({
  name: "createPullRequest",
  ignore: !env.CI,
  fn: async (t) => {
    const branch = "test-" + Date.now().valueOf();

    await t.step("createBranch", async () => {
      await github.createBranch(repo, branch, base);
    });

    const update = new Update("mod.ts", {
      name: "hasundue/denopendabot",
      initial: "0.5.4", // @denopendabot hasundue/denopendabot
      target: "1.0.0",
    });
    const message = update.message();

    await t.step("createCommit", async () => {
      const result = await github.createCommit(repo, branch, message, [update]);
      assertEquals(result.message, message);
    });

    await t.step("createPullRequest (new)", async () => {
      const result = await github.createPullRequest(
        repo,
        branch,
        message,
        base,
      );
      assertEquals(result.title, message);
    });

    await t.step("createPullRequest (update)", async () => {
      const result = await github.createPullRequest(
        repo,
        branch,
        message,
        base,
      );
      assertEquals(result.title, message);
    });

    await t.step("updateBranch", async () => {
      // reset to the head of main
      await github.updateBranch(repo, branch, base);

      const baseCommit = await github.getCommit(repo, base);
      const headCommit = await github.getCommit(repo, branch);

      assertEquals(baseCommit.sha, headCommit.sha);
    });

    await t.step("deleteBranch", async () => {
      await github.deleteBranch(repo, branch);
    });
  },
});
