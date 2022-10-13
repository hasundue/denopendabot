import { assertEquals } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { pullRequestType, removeIgnore } from "./common.ts";
import { Update } from "./repo.ts";

Deno.test("pullRequestType", () => {
  const spec = { name: "denoland/deno", target: "v1.26.1" };

  assertEquals(
    pullRequestType([new Update("deps.ts", spec)]),
    "build",
  );
  assertEquals(
    pullRequestType([new Update(".github/workflows/ci.yml", spec)]),
    "ci",
  );
  assertEquals(
    pullRequestType([new Update("README.md", spec)]),
    "docs",
  );
  assertEquals(
    pullRequestType([new Update("action.yml", spec)]),
    "build",
  );
  assertEquals(
    pullRequestType([
      new Update(".github/workflows/ci.yml", spec),
      new Update("README.md", spec),
    ]),
    "ci",
  );
  assertEquals(
    pullRequestType([
      new Update("deps.ts", spec),
      new Update(".github/workflows/ci.yml", spec),
      new Update("README.md", spec),
    ]),
    "build",
  );
});

Deno.test("removeIgnore (line)", () => {
  const input = `
    Do not ignore this
    Ignore this // @denopendabot ignore
    Do not ignore this`;

  const output = removeIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});

Deno.test("removeIgnore (.md section)", () => {
  const input = `
    Do not ignore this
    <!-- denopendabot-ignore-start -->
    Ignore this
    <!-- denopendabot-ignore-end -->
    Do not ignore this`;

  const output = removeIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});
