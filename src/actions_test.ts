import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { update } from "./actions.ts";

const latest = "v1.26.1"; // @denopendabot denoland/deno

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
    [
      {
        name: "denoland/setup-deno",
        with: "deno-version",
        repo: {
          name: "denoland/deno",
          latest: latest,
        },
      },
    ],
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
