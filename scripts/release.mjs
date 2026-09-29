import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const target = process.argv[2] ?? 'npm';
if (!['npm', 'github'].includes(target))
  throw new Error('Expected npm or github');
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist', 'release', target);
const names = [
  'protocol',
  'browser',
  'core',
  'storage-memory',
  'storage-file',
  'react',
  'vite',
  'cli',
  'otel',
];
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
// Fail before packing or publication if release metadata is incomplete.
await readFile(join(root, 'docs', 'releases', `v${version}.md`));
for (const name of names) {
  const manifest = JSON.parse(
    await readFile(join(root, 'packages', name, 'package.json')),
  );
  if (manifest.version !== version)
    throw new Error(`Version mismatch for ${name}: expected ${version}`);
}
await mkdir(output, { recursive: true });
for (const name of names) {
  const source = join(root, 'packages', name);
  const stage = join(output, name);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const manifest = JSON.parse(await readFile(join(source, 'package.json')));
  manifest.version = version;
  manifest.description ??= `TraceLens ${name}: frontend performance debugging`;
  manifest.license = 'MIT';
  manifest.repository = {
    type: 'git',
    url: 'git+https://github.com/leracherry/tracelens.git',
    directory: `packages/${name}`,
  };
  manifest.homepage = 'https://github.com/leracherry/tracelens#readme';
  manifest.bugs = { url: 'https://github.com/leracherry/tracelens/issues' };
  manifest.keywords = ['tracelens', 'performance', 'rum', 'inp', 'react'];
  manifest.files = ['dist', ...(name === 'cli' ? ['studio'] : [])];
  manifest.exports = {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
      default: './dist/index.js',
    },
  };
  manifest.types = './dist/index.d.ts';
  manifest.main = './dist/index.js';
  manifest.publishConfig = {
    access: 'public',
    registry:
      target === 'github'
        ? 'https://npm.pkg.github.com'
        : 'https://registry.npmjs.org',
  };
  delete manifest.devDependencies;
  delete manifest.scripts;
  if (manifest.dependencies)
    manifest.dependencies = Object.fromEntries(
      Object.entries(manifest.dependencies).map(([key, value]) => [
        key,
        value.startsWith('workspace:') ? version : value,
      ]),
    );
  await cp(join(source, 'dist'), join(stage, 'dist'), {
    recursive: true,
    filter: (path) => !path.includes('.test.'),
  });
  if (name === 'cli')
    await cp(join(root, 'apps/studio/dist'), join(stage, 'studio'), {
      recursive: true,
    });
  await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
  await cp(join(source, 'README.md'), join(stage, 'README.md'));
  await writeFile(
    join(stage, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  execFileSync('npm', ['pack', '--pack-destination', output], {
    cwd: stage,
    stdio: 'inherit',
  });
}
