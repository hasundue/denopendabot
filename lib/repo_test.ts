import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { UpdateSpec } from "./common.ts";
import { getUpdateSpecs, regexp, Update, versionRegExp } from "./repo.ts";

const repo = "denoland/deno";
const initial = "v1.26.0";
const target = "v1.26.1"; // @denopendabot denoland/deno
const content = `  .version("${initial}") // @denopendabot ${repo}`;

Deno.test("regexp", () => {
  const matches = content.matchAll(regexp());
  for (const match of matches) {
    assertEquals(match[2], "v1.26.0");
    assertEquals(match[7], "denoland/deno");
  }
});

Deno.test("versionRegExp", () => {
  const matches = content.matchAll(
    versionRegExp(repo),
  );
  for (const match of matches) {
    assert(match);
    assertEquals(match[0], initial);
  }
});

Deno.test("getUpdateSpecs", async () => {
  const specs = await getUpdateSpecs(content);
  assertEquals(specs.length, 1);
  assertEquals(specs[0].name, "denoland/deno");
  assertEquals(specs[0].initial, "v1.26.0");
});

Deno.test("Update.content", () => {
  const spec: UpdateSpec = { name: repo, target };
  const update = new Update("main.ts", spec);
  assertEquals(
    update.content(content),
    `  .version("${target}") // @denopendabot ${repo}`,
  );
});
