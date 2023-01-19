import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.173.0/testing/asserts.ts";
import { describe, it } from "https://deno.land/std@0.173.0/testing/bdd.ts";
import { UpdateSpec } from "./common.ts";
import {
  getRepoUpdateSpecs,
  regexp,
  RepoUpdate,
  versionRegExp,
} from "./repo.ts";

// @denopendabot ignore-start

describe("regexp", () => {
  it("source code", () => {
    const s = `
      const deno = "v1.26.0" # @denopendabot denoland/deno
      const deno_std = "0.158.0" # @denopendabot denoland/deno_std
    `;
    const m = Array.from(s.matchAll(regexp()));

    assert(m[0]);
    assertEquals(m[0][1], "v1.26.0");
    assertEquals(m[0][6], "denoland/deno");

    assert(m[1]);
    assertEquals(m[1][1], "0.158.0");
    assertEquals(m[1][6], "denoland/deno_std");
  });

  it("plain text in markdown", () => {
    const s = `
      deno: v1.26.0 <!-- @denopendabot denoland/deno -->
      deno_std: 0.158.0 <!-- @denopendabot denoland/deno_std -->
    `;
    const m = Array.from(s.matchAll(regexp()));

    assert(m[0]);
    assertEquals(m[0][1], "v1.26.0");
    assertEquals(m[0][6], "denoland/deno");

    assert(m[1]);
    assertEquals(m[1][1], "0.158.0");
    assertEquals(m[1][6], "denoland/deno_std");
  });

  it("badges in markdown", () => {
    const s = `
      ![deno](https://img.shields.io/badge/Deno-v1.26.0-blue) <!-- @denopendabot denoland/deno -->
      ![deno_std](https://img.shields.io/badge/std-0.158.0-blue) <!-- @denopendabot denoland/deno_std -->
    `;
    const m = Array.from(s.matchAll(regexp()));

    assert(m[0]);
    assertEquals(m[0][1], "v1.26.0");
    assertEquals(m[0][6], "denoland/deno");

    assert(m[1]);
    assertEquals(m[1][1], "0.158.0");
    assertEquals(m[1][6], "denoland/deno_std");
  });

  it("GitHub Action", () => {
    const s = `
      - uses: denoland/setup-deno@v1
        with:
        deno-version: v1.26.0 # @denopendabot denoland/deno
    `;
    const m = Array.from(s.matchAll(regexp()));
    assert(m[0]);
    assertEquals(m[0][1], "v1.26.0");
    assertEquals(m[0][6], "denoland/deno");
  });
});

describe("versionRegExp", () => {
  it("denoland/deno", (t) => {
    const s = `
      const deno = "v1.26.0" # @denopendabot denoland/deno
      const deno_std = "0.158.0" # @denopendabot denoland/deno_std
    `;
    const m = Array.from(s.matchAll(versionRegExp(t.name)));

    assertEquals(m.length, 1);
    assertEquals(m[0][0], "v1.26.0");
  });

  it("denoland/deno_std", (t) => {
    const s = `
      const deno = "v1.26.0" # @denopendabot denoland/deno
      const deno_std = "0.158.0" # @denopendabot denoland/deno_std
    `;
    const m = Array.from(s.matchAll(versionRegExp(t.name)));

    assertEquals(m.length, 1);
    assertEquals(m[0][0], "0.158.0");
  });
});

describe("getUpdateSpecs", () => {
  it("denoland/deno, denoland/deno_std", async () => {
    const s = `
      const deno = "v1.26.0" # @denopendabot denoland/deno
      const deno_std = "0.158.0" # @denopendabot denoland/deno_std
    `;
    const specs = await getRepoUpdateSpecs(s);

    assertEquals(specs.length, 2);

    assertEquals(specs[0].name, "denoland/deno");
    assertEquals(specs[0].initial, "v1.26.0");

    assertEquals(specs[1].name, "denoland/deno_std");
    assertEquals(specs[1].initial, "0.158.0");
  });

  it("cloudflare/wrangler2", async () => {
    const s = "2.1.6 <!-- @denopendabot cloudflare/wrangler2";
    const specs = await getRepoUpdateSpecs(s);

    assertEquals(specs.length, 1);

    assertEquals(specs[0].name, "cloudflare/wrangler2");
    assertEquals(specs[0].initial, "2.1.6");
  });

  it("nodejs/node", async () => {
    const s = "v16.7.0 <!-- @denopendabot nodejs/node";
    const specs = await getRepoUpdateSpecs(s);
    console.log(specs);

    assertEquals(specs.length, 1);

    assertEquals(specs[0].name, "nodejs/node");
    assertEquals(specs[0].initial, "v16.7.0");
  });
});

describe("getUpdateSpecs (release)", async () => {
  const s = `
    const deno = "v1.26.0" # @denopendabot denoland/deno
    const deno_std = "0.158.0" # @denopendabot denoland/deno_std
  `;
  const specs = await getRepoUpdateSpecs(s, {
    name: "denoland/deno",
    target: "v2.0.0",
  });
  assertEquals(specs.length, 1);

  assertEquals(specs[0].name, "denoland/deno");
  assertEquals(specs[0].initial, "v1.26.0");
  assertEquals(specs[0].target, "v2.0.0");
});

describe("Update.content", () => {
  const s = `
    const deno = "v1.26.0" # @denopendabot denoland/deno
    const deno_std = "0.158.0" # @denopendabot denoland/deno_std
  `;
  const spec: UpdateSpec = { name: "denoland/deno", target: "v2.0.0" };
  const update = new RepoUpdate("mod.ts", spec);

  assertEquals(
    update.content(s),
    s.replace("v1.26.0", "v2.0.0"),
  );
});

// @denopendabot ignore-end
