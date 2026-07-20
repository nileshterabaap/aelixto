import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const LOCK_FILE = path.join(PROJECT_ROOT, '.stability-lock.json');

const DEFAULT_LOCK = {
  version: 1,
  protectedFiles: [
    'src/components/HydratedFeedPost.tsx',
    'src/components/RawEmbedRenderer.tsx',
    'src/lib/resolveRenderer.ts',
    'src/index.css',
  ],
  frozen: { tokenHash: null, files: [] },
  baseline: {},
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const sha256 = (content) => createHash('sha256').update(content).digest('hex');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const getAbsolutePath = (relativePath) => path.join(PROJECT_ROOT, relativePath);

const readTextFile = (relativePath) => fs.readFileSync(getAbsolutePath(relativePath), 'utf8');

const ensureLockFile = () => {
  if (!fs.existsSync(LOCK_FILE)) {
    writeJson(LOCK_FILE, DEFAULT_LOCK);
  }

  const lock = readJson(LOCK_FILE);
  if (!Array.isArray(lock.protectedFiles)) lock.protectedFiles = [...DEFAULT_LOCK.protectedFiles];
  if (!lock.baseline || typeof lock.baseline !== 'object') lock.baseline = {};
  if (!lock.frozen || typeof lock.frozen !== 'object') lock.frozen = { tokenHash: null, files: [] };
  if (!Array.isArray(lock.frozen.files)) lock.frozen.files = [];
  return lock;
};

const writeBaselineForFile = (lock, relativePath) => {
  const absolutePath = getAbsolutePath(relativePath);
  if (!fs.existsSync(absolutePath)) return false;

  const content = readTextFile(relativePath);
  lock.baseline[relativePath] = {
    hash: sha256(content),
    contentBase64: Buffer.from(content, 'utf8').toString('base64'),
    capturedAt: new Date().toISOString(),
  };
  return true;
};

const ensureMissingBaselines = (lock) => {
  let changed = false;

  for (const file of lock.protectedFiles.map(toPosixPath)) {
    if (!lock.baseline[file]) {
      changed = writeBaselineForFile(lock, file) || changed;
    }
  }

  return changed;
};

const getDrift = (lock) => {
  const drift = [];

  for (const file of lock.protectedFiles.map(toPosixPath)) {
    const baseline = lock.baseline[file];
    if (!baseline?.contentBase64) {
      drift.push({ file, reason: 'missing_baseline' });
      continue;
    }

    const absolutePath = getAbsolutePath(file);
    if (!fs.existsSync(absolutePath)) {
      drift.push({ file, reason: 'deleted' });
      continue;
    }

    const currentHash = sha256(readTextFile(file));
    if (currentHash !== baseline.hash) {
      drift.push({ file, reason: 'changed' });
    }
  }

  return drift;
};

const printList = (title, list) => {
  console.log(`\n${title}`);
  for (const item of list) {
    console.log(`- ${item.file} (${item.reason})`);
  }
};

const save = (lock) => writeJson(LOCK_FILE, lock);

const command = process.argv[2] ?? 'status';
const lock = ensureLockFile();

if (ensureMissingBaselines(lock)) {
  save(lock);
}

const frozenSet = new Set((lock.frozen?.files || []).map(toPosixPath));
const isFrozen = (file) => frozenSet.has(toPosixPath(file));

const verifyFrozenToken = () => {
  if (frozenSet.size === 0) return true;
  const provided =
    process.env.STABILITY_APPROVAL_TOKEN ||
    (process.argv.find((a) => a.startsWith('--token=')) || '').slice(8);
  if (!provided) return false;
  const expected = lock.frozen?.tokenHash || '';
  const hash = 'sha256:' + createHash('sha256').update(provided).digest('hex');
  return hash === expected;
};

if (command === 'approve') {
  const tokenOk = verifyFrozenToken();
  let approved = 0;
  let skipped = [];

  for (const file of lock.protectedFiles.map(toPosixPath)) {
    if (isFrozen(file) && !tokenOk) {
      skipped.push(file);
      continue;
    }
    if (writeBaselineForFile(lock, file)) approved += 1;
  }

  save(lock);
  console.log(`✅ Stability baseline approved for ${approved} file(s).`);
  if (skipped.length > 0) {
    console.log('\n🔒 Frozen files skipped (missing/invalid STABILITY_APPROVAL_TOKEN):');
    for (const f of skipped) console.log(`- ${f}`);
    console.log('\nRe-run with: STABILITY_APPROVAL_TOKEN=<token> npm run stability:approve');
    process.exit(2);
  }
  process.exit(0);
}

if (command === 'restore') {
  const drift = getDrift(lock).filter((item) => item.reason !== 'missing_baseline');

  if (drift.length === 0) {
    console.log('✅ Stability guard: no unintended changes detected.');
    process.exit(0);
  }

  for (const item of drift) {
    const snapshot = lock.baseline[item.file];
    const restored = Buffer.from(snapshot.contentBase64, 'base64').toString('utf8');
    const target = getAbsolutePath(item.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, restored, 'utf8');
  }

  printList('♻️ Restored protected files:', drift);
  process.exit(0);
}

if (command === 'check') {
  const drift = getDrift(lock).filter((item) => item.reason !== 'missing_baseline');

  if (drift.length > 0) {
    printList('❌ Stability guard found unintended changes:', drift);
    console.log('\nRun: npm run stability:restore  (or)  npm run stability:approve');
    process.exit(1);
  }

  console.log('✅ Stability guard check passed.');
  process.exit(0);
}

if (command === 'status') {
  const drift = getDrift(lock);

  if (drift.length === 0) {
    console.log('✅ Stability guard status: everything matches baseline.');
    if (frozenSet.size > 0) {
      console.log(`\n🔒 Frozen files (require STABILITY_APPROVAL_TOKEN to re-approve):`);
      for (const f of frozenSet) console.log(`- ${f}`);
    }
    process.exit(0);
  }

  printList('⚠️ Stability guard status:', drift);
  process.exit(0);
}

console.log('Usage: node scripts/stability-guard.mjs [status|check|restore|approve]');
process.exit(1);
