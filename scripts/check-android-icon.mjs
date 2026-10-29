#!/usr/bin/env node
// Checks that the Android project on this computer really contains the
// Aelixto icon from resources/ before an APK/AAB is built. Prints plain
// PASS/FAIL lines. Pure Node (no native modules) so it runs anywhere.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.cwd();
const res = join(root, "android", "app", "src", "main", "res");
const source = join(root, "resources", "icon-foreground.png");
let failed = false;
const ok = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => {
  failed = true;
  console.log(`  FAIL  ${m}`);
};

function decodePng(path) {
  const buf = readFileSync(path);
  let off = 8;
  let w, h, depth, type, interlace, palette, trns;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const kind = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (kind === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      type = data[9];
      interlace = data[12];
    } else if (kind === "PLTE") palette = data;
    else if (kind === "tRNS") trns = data;
    else if (kind === "IDAT") idat.push(data);
    else if (kind === "IEND") break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG format in ${path}`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[y * stride + x - ch] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? px[(y - 1) * stride + x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const rgba = (x, y) => {
    const i = (y * w + x) * ch;
    if (type === 6) return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    if (type === 2) return [px[i], px[i + 1], px[i + 2], 255];
    if (type === 0) return [px[i], px[i], px[i], 255];
    if (type === 4) return [px[i], px[i], px[i], px[i + 1]];
    const p = px[i];
    return [palette[p * 3], palette[p * 3 + 1], palette[p * 3 + 2], trns && p < trns.length ? trns[p] : 255];
  };
  return { w, h, rgba };
}

// 8x8 grid of average colours (composited on white), for a rough "same picture?" check.
function fingerprint(img) {
  const n = 8, out = [];
  for (let gy = 0; gy < n; gy++)
    for (let gx = 0; gx < n; gx++) {
      const s = [0, 0, 0];
      let k = 0;
      for (let y = Math.floor((gy * img.h) / n); y < Math.floor(((gy + 1) * img.h) / n); y += 2)
        for (let x = Math.floor((gx * img.w) / n); x < Math.floor(((gx + 1) * img.w) / n); x += 2) {
          const [r, g, b, a] = img.rgba(x, y);
          const t = a / 255;
          s[0] += r * t + 255 * (1 - t);
          s[1] += g * t + 255 * (1 - t);
          s[2] += b * t + 255 * (1 - t);
          k++;
        }
      out.push(...s.map((v) => v / k));
    }
  return out;
}

console.log("[icon-check] Checking Android app icon…");
if (!existsSync(res)) {
  console.log("  SKIP  no android/ folder on this computer");
  process.exit(0);
}

const manifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
const manifest = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
if (/android:icon="@mipmap\/ic_launcher"/.test(manifest)) ok("app uses @mipmap/ic_launcher");
else bad("AndroidManifest.xml does not use android:icon=\"@mipmap/ic_launcher\"");

const adaptive = join(res, "mipmap-anydpi-v26", "ic_launcher.xml");
const adaptiveXml = existsSync(adaptive) ? readFileSync(adaptive, "utf8") : "";
if (adaptiveXml.includes("@mipmap/ic_launcher_foreground") && adaptiveXml.includes("@mipmap/ic_launcher_background"))
  ok("adaptive icon points to the generated Aelixto pictures");
else bad("mipmap-anydpi-v26/ic_launcher.xml is still the old/default one — run: npm run assets:generate");

const want = fingerprint(decodePng(source));
for (const d of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  const p = join(res, `mipmap-${d}`, "ic_launcher_foreground.png");
  if (!existsSync(p)) {
    bad(`mipmap-${d}/ic_launcher_foreground.png missing — run: npm run assets:generate`);
    continue;
  }
  try {
    const got = fingerprint(decodePng(p));
    const diff = got.reduce((s, v, i) => s + Math.abs(v - want[i]), 0) / got.length;
    if (diff < 18) ok(`mipmap-${d} has the new Aelixto logo`);
    else bad(`mipmap-${d} has a DIFFERENT (old) logo — run: git pull, then npm run assets:generate`);
  } catch (e) {
    console.log(`  WARN  could not read mipmap-${d}: ${e.message}`);
  }
}

console.log(
  failed
    ? "[icon-check] FAILED — the APK would still show the old icon."
    : "[icon-check] OK — build the APK, uninstall the old app, then install.",
);
process.exit(failed ? 1 : 0);
