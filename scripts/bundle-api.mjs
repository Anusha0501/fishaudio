import { build } from "esbuild";
import { unlink } from "node:fs/promises";

const entries = [
  "api/health.ts",
  "api/speak.ts",
  "api/rooms/index.ts",
  "api/rooms/[id].ts",
  "api/rooms/[id]/messages.ts",
];

if (!process.env.VERCEL) {
  process.exit(0);
}

await build({
  entryPoints: entries,
  bundle: true,
  platform: "node",
  format: "esm",
  outdir: "api",
  outbase: "api",
  packages: "external",
  logLevel: "info",
});

await Promise.all(entries.map((entry) => unlink(entry)));
