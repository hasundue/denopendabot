import { assertEquals } from "https://deno.land/std@0.151.0/testing/asserts.ts";
import { main } from "./main.ts";

Deno.test("hello()", () => {
  assertEquals(
    main(),
    "Hello, World!",
  );
});
