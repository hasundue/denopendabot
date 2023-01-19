import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";

import { getDeployments, parseID } from "./deployments.ts";

describe("parseID", () => {
  it("URL with an ID", () => {
    assertEquals(
      parseID("https://denopendabot-vg84wk9s1jt0.deno.dev"),
      "vg84wk9s1jt0",
    );
  });
  it("URL without an ID", () => {
    assertThrows(
      () => parseID("https://denopendabot.deno.dev"),
    );
  });
});

describe("getDeployments", async () => {
  const deployments = await getDeployments();
  assert(deployments);
});
