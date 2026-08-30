#!/usr/bin/env node
// Per-platform freeze system. Complements stability-guard.mjs.
// Design goal: the agent can FREEZE (snapshot current known-good behavior)
// but cannot UNFREEZE / RE-GUARD without the user's STABILITY_TOKEN.
// This ensures that once you say "guard it", the baseline for that platform
// cannot be silently overwritten in a later agent turn.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, '.stability-platforms.json');

const sha = (s) => createHash('sha256').update(s).digest('hex');
const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const write = (v) => fs.writeFileSync(FILE, JSON.stringify(v, null, 2) + '\n');
const abs = (p) => path.join(ROOT, p);
const rd = (p) => fs.readFileSync(abs(p), 'utf8');

const requireToken = (data) => {
  const t = process.env.STABILITY_TOKEN;
  if (!data.tokenHash) {
    console.error('❌ No token has been sealed yet. Run: STABILITY_TOKEN=<your-secret> npm run platform:seal');
    process.exit(1);
  }
  if (!t) {
    console.error('❌ STABILITY_TOKEN env var required for this operation.');
    process.exit(1);
  }
  if (sha(t) !== data.tokenHash) {
    console.error('❌ STABILITY_TOKEN does not match the sealed token.');
    process.exit(1);
  }
};

const snapshot = (files) => {
  const out = {};
  for (const f of files) {
    if (!fs.existsSync(abs(f))) {
      console.error(`❌ File missing, cannot snapshot: ${f}`);
      process.exit(1);
    }
    const c = rd(f);
    out[f] = { hash: sha(c), contentBase64: Buffer.from(c, 'utf8').toString('base64') };
  }
  return out;
};

const driftForPlatform = (name, p) => {
  const drift = [];
  if (!p.frozen) return drift;
  for (const f of p.files) {
    const base = p.baseline?.[f];
    if (!base) { drift.push({ platform: name, file: f, reason: 'missing_baseline' }); continue; }
    if (!fs.existsSync(abs(f))) { drift.push({ platform: name, file: f, reason: 'deleted' }); continue; }
    if (sha(rd(f)) !== base.hash) drift.push({ platform: name, file: f, reason: 'changed' });
  }
  return drift;
};

const cmd = process.argv[2] ?? 'status';
const arg = process.argv[3];
const data = read();

if (cmd === 'seal') {
  // One-time: user sets the master token that gates unfreeze/re-guard.
  const t = process.env.STABILITY_TOKEN;
  if (!t) { console.error('❌ Set STABILITY_TOKEN env var, then re-run.'); process.exit(1); }
  if (data.tokenHash) {
    console.error('❌ Token already sealed. Use: rotate (with old token in STABILITY_TOKEN and new in STABILITY_TOKEN_NEW).');
    process.exit(1);
  }
  data.tokenHash = sha(t);
  write(data);
  console.log('✅ Token sealed. Keep STABILITY_TOKEN safe — it is required for unfreeze / re-guard.');
  process.exit(0);
}

if (cmd === 'rotate') {
  requireToken(data);
  const n = process.env.STABILITY_TOKEN_NEW;
  if (!n) { console.error('❌ Set STABILITY_TOKEN_NEW to the new token.'); process.exit(1); }
  data.tokenHash = sha(n);
  write(data);
  console.log('✅ Token rotated.');
  process.exit(0);
}

if (cmd === 'guard') {
  // Freeze current file contents for a platform. Allowed without token IF
  // the platform is not currently frozen; re-guarding a frozen platform
  // requires the token (prevents silent baseline overwrite).
  if (!arg || !data.platforms[arg]) { console.error(`❌ Unknown platform: ${arg}`); process.exit(1); }
  const p = data.platforms[arg];
  if (p.frozen) {
    console.error(`⚠️  Platform "${arg}" is already frozen. To update the frozen baseline you must re-guard with the token.`);
    requireToken(data);
  }
  p.baseline = snapshot(p.files);
  p.frozen = true;
  p.frozenAt = new Date().toISOString();
  write(data);
  console.log(`✅ Guarded platform "${arg}" (${p.files.length} file(s)).`);
  process.exit(0);
}

if (cmd === 'unfreeze') {
  if (!arg || !data.platforms[arg]) { console.error(`❌ Unknown platform: ${arg}`); process.exit(1); }
  requireToken(data);
  data.platforms[arg].frozen = false;
  write(data);
  console.log(`✅ Unfrozen platform "${arg}". Its baseline can now be re-snapshotted with: npm run platform:guard ${arg}`);
  process.exit(0);
}

if (cmd === 'restore') {
  // Safe: writes files back to their frozen baseline. No token needed.
  if (!arg || !data.platforms[arg]) { console.error(`❌ Unknown platform: ${arg}`); process.exit(1); }
  const p = data.platforms[arg];
  if (!p.frozen) { console.log(`ℹ️  Platform "${arg}" is not frozen; nothing to restore.`); process.exit(0); }
  const drift = driftForPlatform(arg, p);
  if (drift.length === 0) { console.log(`✅ Platform "${arg}" already matches its frozen baseline.`); process.exit(0); }
  for (const d of drift) {
    if (d.reason === 'missing_baseline') continue;
    const b = p.baseline[d.file];
    fs.mkdirSync(path.dirname(abs(d.file)), { recursive: true });
    fs.writeFileSync(abs(d.file), Buffer.from(b.contentBase64, 'base64').toString('utf8'), 'utf8');
    console.log(`♻️  restored ${d.file}`);
  }
  process.exit(0);
}

if (cmd === 'check') {
  // Regression check: fail build if any frozen platform drifted.
  const all = [];
  for (const [name, p] of Object.entries(data.platforms)) all.push(...driftForPlatform(name, p));
  if (all.length === 0) {
    const frozen = Object.entries(data.platforms).filter(([, p]) => p.frozen).map(([n]) => n);
    console.log(`✅ Platform guard: no drift. Frozen platforms: ${frozen.join(', ') || '(none)'}`);
    process.exit(0);
  }
  console.error('❌ Platform guard FAILED — guarded platforms have drifted:');
  for (const d of all) console.error(`   • [${d.platform}] ${d.file} — ${d.reason}`);
  console.error('\nTo intentionally update a guarded platform:');
  console.error('  1. STABILITY_TOKEN=<secret> npm run platform:unfreeze <name>');
  console.error('  2. Make changes');
  console.error('  3. STABILITY_TOKEN=<secret> npm run platform:guard <name>');
  console.error('Or to revert: npm run platform:restore <name>');
  process.exit(1);
}

if (cmd === 'status') {
  console.log(`Token sealed: ${data.tokenHash ? 'yes' : 'NO (run platform:seal first)'}`);
  for (const [name, p] of Object.entries(data.platforms)) {
    const state = p.frozen ? '🔒 FROZEN' : '⚪ open  ';
    const drift = driftForPlatform(name, p);
    const suffix = drift.length ? `  ⚠️ drift: ${drift.map(d => d.file + '(' + d.reason + ')').join(', ')}` : '';
    console.log(`  ${state}  ${name}  files=${p.files.length}${suffix}`);
  }
  process.exit(0);
}

console.log('Usage: node scripts/platform-guard.mjs [status|seal|rotate|guard <name>|unfreeze <name>|restore <name>|check]');
process.exit(1);