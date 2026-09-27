import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export interface DoctorCheck {
  status: 'pass' | 'warn' | 'fail';
  label: string;
  detail?: string;
}

export async function runDoctor(directory: string): Promise<DoctorCheck[]> {
  const packageJson = await readPackageJson(directory);
  const dependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  } as Record<string, string>;
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const sourceMaps = await containsSourceMaps(join(directory, 'dist'));
  const releaseConfigured = Boolean(
    process.env.TRACELENS_RELEASE || process.env.GITHUB_SHA,
  );

  return [
    {
      status: nodeMajor >= 22 ? 'pass' : 'fail',
      label: 'Node.js 22 or newer',
      detail: process.versions.node,
    },
    {
      status: dependencies['@tracelens/browser'] ? 'pass' : 'warn',
      label: 'browser SDK installed',
      detail: dependencies['@tracelens/browser'] ?? 'not found in package.json',
    },
    {
      status: dependencies['@tracelens/react'] ? 'pass' : 'warn',
      label: 'React instrumentation enabled',
      detail: dependencies['@tracelens/react'] ?? 'optional',
    },
    {
      status: releaseConfigured ? 'pass' : 'warn',
      label: 'release configured',
      detail:
        process.env.TRACELENS_RELEASE ??
        process.env.GITHUB_SHA ??
        'set TRACELENS_RELEASE',
    },
    {
      status: sourceMaps ? 'pass' : 'warn',
      label: 'source maps available',
      detail: sourceMaps
        ? 'dist contains .map files'
        : 'no dist source maps found',
    },
  ];
}

export function formatDoctor(
  checks: readonly DoctorCheck[],
  color = false,
): string {
  const icon = { pass: '✓', warn: '⚠', fail: '✗' } as const;
  const code = { pass: 32, warn: 33, fail: 31 } as const;
  const line = (check: DoctorCheck) => {
    const marker = color
      ? `\u001B[${code[check.status]}m${icon[check.status]}\u001B[0m`
      : icon[check.status];
    return `${marker} ${check.label}${check.detail ? `  ${check.detail}` : ''}`;
  };
  return ['TraceLens doctor', '', ...checks.map(line)].join('\n');
}

async function readPackageJson(directory: string): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null> {
  try {
    return JSON.parse(
      await readFile(join(directory, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  } catch {
    return null;
  }
}

async function containsSourceMaps(directory: string): Promise<boolean> {
  try {
    await access(directory, constants.R_OK);
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(directory, { recursive: true });
    return entries.some((entry) => String(entry).endsWith('.map'));
  } catch {
    return false;
  }
}
