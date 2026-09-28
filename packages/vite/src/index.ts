import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface BuildMetadata {
  release?: string;
  commit?: string;
  buildTimestamp?: string;
  environment?: string;
}

export interface TracelensPluginOptions extends BuildMetadata {
  root?: string;
}

export interface DiscoveredBuildMetadata {
  packageVersion?: string;
  commit?: string;
  buildTimestamp: string;
  environment?: string;
}

export function createBuildMetadata(
  options: BuildMetadata,
  discovered: DiscoveredBuildMetadata,
): BuildMetadata {
  return {
    release: options.release ?? discovered.packageVersion,
    commit: options.commit ?? discovered.commit,
    buildTimestamp: options.buildTimestamp ?? discovered.buildTimestamp,
    environment: options.environment ?? discovered.environment,
  };
}

export function tracelens(options: TracelensPluginOptions = {}): Plugin {
  return {
    name: 'tracelens:build-metadata',
    enforce: 'pre',
    config(config, env) {
      const root = resolve(options.root ?? config.root ?? process.cwd());
      const metadata = createBuildMetadata(options, {
        packageVersion: findPackageVersion(root),
        commit: findCommit(root),
        buildTimestamp: new Date().toISOString(),
        environment: env.mode,
      });

      return {
        define: {
          __TRACELENS_BUILD_METADATA__: JSON.stringify(metadata),
        },
      };
    },
  };
}

function findPackageVersion(start: string): string | undefined {
  let directory = start;
  while (true) {
    const manifest = join(directory, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
          version?: unknown;
        };
        if (typeof parsed.version === 'string') return parsed.version;
      } catch {
        // Keep looking when an ancestor manifest cannot be read or parsed.
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function findCommit(root: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}
