import { assertEquals } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { Client } from "./github.ts";
import { UpdateSpec } from "./common.ts";
import { getUpdateSpecs, regexp, Update, versionRegExp } from "./repo.ts";

const github = new Client();
const repo = "denoland/deno";
const initial = "v1.26.0";
const target = "v1.26.1"; // @denopendabot denoland/deno
const content = (version = initial) => `
Deno version: ${version} <!-- @denopendabot ${repo} -->
`;

Deno.test("regexp", () => {
  const matches = Array.from(content().matchAll(regexp()));
  assertEquals(matches.length, 1);
  assertEquals(matches[0][2], "v1.26.0");
  assertEquals(matches[0][7], "denoland/deno");
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
  const specs = await getUpdateSpecs(github, content());
  assertEquals(specs.length, 1);
  assertEquals(specs[0].name, "denoland/deno");
  assertEquals(specs[0].initial, "v1.26.0");
});

Deno.test("Update.content", () => {
  const spec: UpdateSpec = { name: repo, target };
  const update = new Update("README.md", spec);
  assertEquals(
    update.content(content()),
    content(target),
  );
});
