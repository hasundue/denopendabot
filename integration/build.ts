import { VERSION } from "../mod.ts";

const yaml = Deno.readTextFileSync("./action.yml");

Deno.writeTextFileSync(
  "./integration/action.yml",
  yaml.replace(`https://deno.land/x/denopendabot@${VERSION}`, "."),
);
