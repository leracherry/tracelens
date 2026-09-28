import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
];
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
const rename = (name) =>
  target === 'github'
    ? name.replace('@tracelens/', '@leracherry/tracelens-')
    : name;
await mkdir(output, { recursive: true });
for (const name of names) {
  const source = join(root, 'packages', name);
  const stage = join(output, name);
  await mkdir(stage, { recursive: true });
  const manifest = JSON.parse(await readFile(join(source, 'package.json')));
  manifest.name = rename(manifest.name);
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
        rename(key),
        value.startsWith('workspace:') ? version : value,
      ]),
    );
  await cp(join(source, 'dist'), join(stage, 'dist'), {
    recursive: true,
    filter: (path) => !path.includes('.test.'),
  });
  if (target === 'github') {
    for (const file of await readdir(join(stage, 'dist'), {
      recursive: true,
    })) {
      if (!/\.(js|ts|map)$/.test(file)) continue;
      const path = join(stage, 'dist', file);
      await writeFile(
        path,
        (await readFile(path, 'utf8')).replaceAll(
          '@tracelens/',
          '@leracherry/tracelens-',
        ),
      );
    }
  }
  if (name === 'cli')
    await cp(join(root, 'apps/studio/dist'), join(stage, 'studio'), {
      recursive: true,
    });
  await cp(join(root, 'LICENSE'), join(stage, 'LICENSE'));
  await writeFile(
    join(stage, 'README.md'),
    `# ${manifest.name}\n\n${manifest.description}\n\nSee the [documentation](https://github.com/leracherry/tracelens#readme) for setup and examples.\n`,
  );
  await writeFile(
    join(stage, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  execFileSync('npm', ['pack', '--pack-destination', output], {
    cwd: stage,
    stdio: 'inherit',
  });
}
