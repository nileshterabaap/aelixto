import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginFile = path.join(
  root,
  "node_modules/@capacitor-community/safe-area/android/src/main/java/com/getcapacitor/community/safearea/SafeAreaPlugin.java",
);

const original =
  "v.setPadding(systemBarsInsets.left, systemBarsInsets.top, systemBarsInsets.right, keyboardVisible ? imeInsets.bottom : systemBarsInsets.bottom);";
const patched = `// On older WebViews this fallback pads the decor view itself. When the
            // Activity has already reserved the navigation-bar strip, imeInsets.bottom
            // still includes that strip. Subtract it while the IME is visible so the
            // WebView ends at the keyboard instead of one nav-bar height above it.
            int bottomPadding = keyboardVisible
                    ? Math.max(0, imeInsets.bottom - systemBarsInsets.bottom)
                    : systemBarsInsets.bottom;
            v.setPadding(systemBarsInsets.left, systemBarsInsets.top, systemBarsInsets.right, bottomPadding);`;

let source;
try {
  source = await readFile(pluginFile, "utf8");
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.warn("[safe-area patch] plugin source not installed; skipping");
    process.exit(0);
  }
  throw error;
}

if (source.includes(patched)) {
  console.log("[safe-area patch] Android IME inset correction already applied");
  process.exit(0);
}

if (!source.includes(original)) {
  throw new Error(
    "[safe-area patch] SafeAreaPlugin.java no longer matches 8.0.1; review the Android inset patch before upgrading",
  );
}

await writeFile(pluginFile, source.replace(original, patched));
console.log("[safe-area patch] Applied Android IME minus navigation-bar correction");