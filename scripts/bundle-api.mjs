import { build } from "esbuild";
import { writeFile } from "node:fs/promises";

const entries = [
  { source: "api/health.ts", bundle: ".vercel-api/health.cjs", shimToBundle: "../.vercel-api/health.cjs" },
  { source: "api/rewrite.ts", bundle: ".vercel-api/rewrite.cjs", shimToBundle: "../.vercel-api/rewrite.cjs" },
  { source: "api/speak.ts", bundle: ".vercel-api/speak.cjs", shimToBundle: "../.vercel-api/speak.cjs" },
  { source: "api/rooms/index.ts", bundle: ".vercel-api/rooms/index.cjs", shimToBundle: "../../.vercel-api/rooms/index.cjs" },
  { source: "api/rooms/[id].ts", bundle: ".vercel-api/rooms/[id].cjs", shimToBundle: "../../.vercel-api/rooms/[id].cjs" },
  {
    source: "api/rooms/[id]/messages.ts",
    bundle: ".vercel-api/rooms/[id]/messages.cjs",
    shimToBundle: "../../../.vercel-api/rooms/[id]/messages.cjs",
  },
];

if (!process.env.VERCEL) {
  process.exit(0);
}

await build({
  entryPoints: Object.fromEntries(entries.map((entry) => [entry.bundle.replace(/\.cjs$/, ""), entry.source])),
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: ".",
  outExtension: { ".js": ".cjs" },
  packages: "external",
  logLevel: "info",
});

const shim = (target) => `import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bundled = require(${JSON.stringify(target)}) as {
  default?: (req: unknown, res: unknown) => unknown;
};

export default function handler(req: unknown, res: unknown): unknown {
  const run = bundled.default ?? (bundled as (req: unknown, res: unknown) => unknown);
  return run(req, res);
}
`;

await Promise.all(entries.map((entry) => writeFile(entry.source, shim(entry.shimToBundle))));
