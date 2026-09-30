import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const roots = [
  'README.md',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs',
  'examples',
  'packages',
];
const markdown = [];

for (const entry of roots) await collect(resolve(root, entry));

const failures = [];
for (const file of markdown) {
  const source = await readFile(file, 'utf8');
  const targets = [
    ...source.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g),
    ...source.matchAll(/(?:href|src)=["']([^"']+)["']/g),
  ].map((match) => match[1]);
  for (const target of targets) {
    if (!target || /^(?:https?:|mailto:|data:|#)/i.test(target)) continue;
    const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
    if (!clean) continue;
    const path = clean.startsWith('/')
      ? resolve(root, 'docs', `.${clean}`)
      : resolve(dirname(file), clean);
    if (!(await exists(path))) {
      failures.push(`${relative(root, file)} → ${target}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Broken local documentation links:\n${failures.join('\n')}`);
}
console.log(
  `Documentation links passed across ${markdown.length} Markdown files.`,
);

async function collect(path) {
  const info = await stat(path);
  if (info.isFile()) {
    if (extname(path) === '.md') markdown.push(path);
    return;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    await collect(join(path, entry.name));
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
