// Copies MapLibre GL's web-worker files into public/maplibre so the browser can load them.
//
// maplibre-gl v6 starts its worker from `./maplibre-gl-worker.mjs` next to its own module. Once
// Next bundles the library that relative URL points nowhere (the request falls through to the app
// and returns HTML), the worker never starts and the map draws no tiles. The map calls
// `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")` instead; this keeps those files in step with
// the installed version. Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
}
console.log(`maplibre worker synced to ${target}`);
