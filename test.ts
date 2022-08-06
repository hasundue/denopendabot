<<<<<<< HEAD
import { assertEquals } from "https://deno.land/std@0.151.0/testing/asserts.ts";
import { main } from "./mod.ts";
=======
import { assertEquals } from "https://deno.land/std@0.151.0/testing/asserts.ts";
import { main } from "./main.ts";
>>>>>>> bc5586b (build: rename mod.ts as main.ts)

Deno.test("hello()", () => {
  assertEquals(
    main(),
    "Hello, World!",
  );
});
