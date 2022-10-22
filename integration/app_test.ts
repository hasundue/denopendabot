import { createCommits, getUpdates } from "../mod.ts";

const repo = "hasundue/denopendabot";
const base = "test";
const branch = "test-app";
const target = "1.0.0";

Deno.test("integration (app)", async () => {
  const options = {
    base,
    branch,
    release: target,
    include: ["mod.ts"],
    test: true,
  };

  const updates = await getUpdates(repo, options);
  await createCommits(repo, updates, options);
});
