import { assertEquals } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { pullRequestType } from "./common.ts";
import { Update } from "./repo.ts";

Deno.test("pullRequestType", () => {
  const spec = { name: "denoland/deno", target: "v1.26.1" };

  assertEquals(
    pullRequestType([new Update("deps.ts", spec)]),
    "build",
  );
  assertEquals(
    pullRequestType([new Update("ci.yml", spec)]),
    "ci",
  );
  assertEquals(
    pullRequestType([new Update("README.md", spec)]),
    "docs",
  );
  assertEquals(
    pullRequestType([
      new Update("ci.yml", spec),
      new Update("README.md", spec),
    ]),
    "ci",
  );
  assertEquals(
    pullRequestType([
      new Update("deps.ts", spec),
      new Update("ci.yml", spec),
      new Update("README.md", spec),
    ]),
    "build",
  );
});
