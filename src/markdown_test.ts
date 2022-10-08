import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { update } from "./markdown.ts";

const latest = "v1.26.1"; // @denopendabot denoland/deno

Deno.test("update", async () => {
  const output = await update(
    "![denoland/deno](https://img.shields.io/badge/Deno-v1.26.0-blue)",
    [{ name: "denoland/deno", latest }],
  );
  assertEquals(
    output,
    `![denoland/deno](https://img.shields.io/badge/Deno-${latest}-blue)`,
  );
});
