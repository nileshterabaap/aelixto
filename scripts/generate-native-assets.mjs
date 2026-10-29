#!/usr/bin/env node
// Runs capacitor-assets with arguments passed directly (no shell), so colour
// values like #ffffff work the same on Windows PowerShell/cmd, macOS and Linux.
// (Quoted '#ffffff' in package.json reached the tool with the quotes on
// Windows, which made icon generation fail silently.)
// Android and iOS run separately so a failure on one cannot skip the other,
// and any "Unable to generate" message makes this script fail loudly.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("@capacitor/assets/package.json"));
const bin = join(pkgDir, "bin", "capacitor-assets");

const colours = [
  "--iconBackgroundColor", "#ffffff",
  "--iconBackgroundColorDark", "#ffffff",
  "--splashBackgroundColor", "#ffffff",
  "--splashBackgroundColorDark", "#ffffff",
];

let failed = false;
for (const platform of ["android", "ios"]) {
  if (!existsSync(join(process.cwd(), platform))) {
    console.log(`[assets] SKIP ${platform}: no ${platform}/ folder on this computer`);
    continue;
  }
  console.log(`[assets] Generating ${platform} icons and splash…`);
  const r = spawnSync(process.execPath, [bin, "generate", "--assetPath", "resources", `--${platform}`, ...colours], {
    encoding: "utf8",
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  process.stdout.write(out);
  if (r.status !== 0 || /Unable to generate|Error:/i.test(out)) {
    failed = true;
    console.log(`[assets] FAILED for ${platform} — see the error above.`);
  } else {
    console.log(`[assets] ${platform} done.`);
  }
}
process.exit(failed ? 1 : 0);
