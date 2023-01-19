import { assertEquals } from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { pullRequestType, removeIgnore } from "./common.ts";

Deno.test("pullRequestType", () => {
  assertEquals(
    pullRequestType(["build"]),
    "build",
  );
  assertEquals(
    pullRequestType(["ci"]),
    "ci",
  );
  assertEquals(
    pullRequestType(["docs"]),
    "docs",
  );
  assertEquals(
    pullRequestType(["ci", "docs"]),
    "ci",
  );
  assertEquals(
    pullRequestType(["build", "ci", "docs"]),
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
    <!-- @denopendabot ignore-start -->
    Ignore this
    <!-- @denopendabot ignore-end -->
    Do not ignore this`;

  const output = removeIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});

Deno.test("removeIgnore (.ts section)", () => {
  const input = `
    Do not ignore this
    // @denopendabot ignore-start
    Ignore this
    // @denopendabot ignore-end
    Do not ignore this`;

  const output = removeIgnore(input);

  assertEquals(
    output,
    `
    Do not ignore this

    Do not ignore this`,
  );
});
