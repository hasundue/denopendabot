import { assert } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { update } from "./mod.ts";

const repo = "hasundue/denopendabot-test";

Deno.test("updateModules", async () => {
  const result = await update(repo, {
    sources: ["deps.ts"],
  });
});
