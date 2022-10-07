import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { getLatestRelease, update } from "./actions.ts";

const latest = await getLatestRelease("denoland/deno");

Deno.test("update", async () => {
  const result = await update(
    `
    jobs:
      test:
        steps:
          - uses: denoland/setup-deno@v1
            with:
              deno-version: v1.26.0
    `,
  );
  assertEquals(
    `
    jobs:
      test:
        steps:
          - uses: denoland/setup-deno@v1
            with:
              deno-version: ${latest}
    `,
    result.output,
  );
  assertEquals(result.repos.length, 1);
  assertEquals(result.repos[0].name, "denoland/deno");
  assertEquals(result.repos[0].initial, "v1.26.0");
  assertEquals(result.repos[0].latest, latest);
});
