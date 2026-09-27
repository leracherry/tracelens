import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StudioOptions {
  host: string;
  port: number;
}

export async function startStudio(options: StudioOptions): Promise<number> {
  const packageDirectory = dirname(fileURLToPath(import.meta.url));
  const workspace = resolve(packageDirectory, '../../..');
  const studio = resolve(workspace, 'apps/studio');
  console.log(
    `TraceLens Studio starting at http://${options.host}:${options.port}`,
  );
  console.log('Press Ctrl+C to stop.');
  const child = spawn(
    'pnpm',
    ['exec', 'vite', '--host', options.host, '--port', String(options.port)],
    { cwd: studio, stdio: 'inherit' },
  );
  return new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) =>
      resolveExit(signal === 'SIGINT' ? 0 : (code ?? 1)),
    );
  });
}
