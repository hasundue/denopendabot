import { assertEquals } from "https://deno.land/std@0.158.0/testing/asserts.ts";
import { update } from "./sources.ts";

const latest = "v1.26.1"; // @denopendabot denoland/deno

Deno.test("update", async () => {
  const output = await update(
    `.version("v1.26.0") // @denopendabot denoland/deno`,
    [{ name: "denoland/deno", latest }],
  );
  assertEquals(
    output,
    `.version("${latest}") // @denopendabot denoland/deno`,
  );
});
