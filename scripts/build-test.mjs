import { build } from "esbuild";

await build({
  entryPoints: ["tests/notion-errors.test.ts"],
  bundle: true,
  format: "cjs",
  outfile: "/tmp/notion-web-assistant.test.cjs",
  platform: "node",
});
