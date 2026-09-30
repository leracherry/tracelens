#!/usr/bin/env node
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { compareReleases } from '@leracherry/tracelens-core';
import { formatReleaseComparison } from './compare.js';
import { formatDoctor, runDoctor } from './doctor.js';
import { formatInteractionReport } from './format.js';
import { startStudio } from './studio.js';
import { uploadSourceMaps } from './source-maps.js';
import { auditPrivacy, formatPrivacyAudit } from './privacy.js';
import { readTraceFile, readTraceUrl } from './trace-file.js';
import {
  evaluateBudgets,
  formatBudgetReport,
  loadBudgetConfig,
} from './budget.js';

const [command, ...args] = process.argv.slice(2);
const cliVersion = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version;

async function main(): Promise<number> {
  switch (command) {
    case 'budget': {
      if (args[0] !== 'check')
        throw new Error(
          'Usage: tracelens budget check [--config tracelens.yml] [--file trace.json] [--release VERSION]',
        );
      const config = await loadBudgetConfig(
        resolve(stringOption(args, '--config', 'tracelens.yml')),
      );
      const file = optionalStringOption(args, '--file');
      const events = file
        ? await readTraceFile(resolve(file))
        : await readTraceUrl(
            stringOption(
              args,
              '--endpoint',
              'http://127.0.0.1:4173/__tracelens',
            ),
          );
      const report = evaluateBudgets(events, config, {
        release: optionalStringOption(args, '--release'),
        app: optionalStringOption(args, '--app'),
        environment: optionalStringOption(args, '--environment'),
      });
      const format = args.includes('--json')
        ? 'json'
        : stringOption(args, '--format', 'text');
      if (!['text', 'json'].includes(format))
        throw new Error('--format must be text or json');
      console.log(
        format === 'json'
          ? JSON.stringify(report, null, 2)
          : formatBudgetReport(report, { color: process.stdout.isTTY }),
      );
      return report.passed ? 0 : 1;
    }
    case 'sourcemaps': {
      if (args[0] !== 'upload' || !args[1] || args[1].startsWith('-'))
        throw new Error(
          'Usage: tracelens sourcemaps upload <dist> --app NAME --release VERSION --url-prefix URL',
        );
      const required = (name: string) => {
        const value = optionalStringOption(args, name);
        if (!value) throw new Error(`${name} is required`);
        return value;
      };
      const count = await uploadSourceMaps(args[1], {
        app: required('--app'),
        release: required('--release'),
        urlPrefix: required('--url-prefix'),
        store: stringOption(args, '--store', '.tracelens/sourcemaps'),
        repository: optionalStringOption(args, '--repository'),
        commit: optionalStringOption(args, '--commit'),
      });
      console.log(
        `Imported ${count} source maps locally. Restart Studio to load them.`,
      );
      return 0;
    }
    case 'privacy': {
      if (args[0] !== 'audit')
        throw new Error('Usage: tracelens privacy audit [--file trace.json]');
      const file = optionalStringOption(args, '--file');
      const events = file
        ? await readTraceFile(resolve(file))
        : await readTraceUrl(
            stringOption(
              args,
              '--endpoint',
              'http://127.0.0.1:4173/__tracelens',
            ),
          );
      console.log(formatPrivacyAudit(events));
      return auditPrivacy(events).length ? 1 : 0;
    }
    case 'inspect': {
      const path = args.find((argument) => !argument.startsWith('-'));
      if (!path) throw new Error('Usage: tracelens inspect <trace.json>');
      const events = await readTraceFile(resolve(path));
      console.log(
        formatInteractionReport(events, { color: process.stdout.isTTY }),
      );
      return 0;
    }
    case 'doctor': {
      const checks = await runDoctor(process.cwd());
      console.log(formatDoctor(checks, process.stdout.isTTY));
      return checks.some((check) => check.status === 'fail') ? 1 : 0;
    }
    case 'compare': {
      const [before, after] = args;
      if (
        !before ||
        !after ||
        before.startsWith('-') ||
        after.startsWith('-')
      ) {
        throw new Error(
          'Usage: tracelens compare <before> <after> [--file trace.json]',
        );
      }
      const file = optionalStringOption(args, '--file');
      const endpoint = stringOption(
        args,
        '--endpoint',
        'http://127.0.0.1:4173/__tracelens',
      );
      const events = file
        ? await readTraceFile(resolve(file))
        : await readTraceUrl(endpoint);
      console.log(
        formatReleaseComparison(compareReleases(events, before, after), {
          color: process.stdout.isTTY,
        }),
      );
      return 0;
    }
    case 'studio': {
      const port = numberOption(args, '--port', 4173);
      const host = stringOption(args, '--host', '127.0.0.1');
      return startStudio({
        host,
        port,
        sourceMaps: stringOption(args, '--store', '.tracelens/sourcemaps'),
      });
    }
    case '--version':
    case '-v':
      console.log(`tracelens ${cliVersion}`);
      return 0;
    case '--help':
    case '-h':
    case undefined:
      console.log(help());
      return 0;
    default:
      throw new Error(`Unknown command: ${command}\n\n${help()}`);
  }
}

function stringOption(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function optionalStringOption(
  args: string[],
  name: string,
): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  if (!args[index + 1] || args[index + 1]!.startsWith('--'))
    throw new Error(`${name} requires a value.`);
  return args[index + 1];
}

function numberOption(args: string[], name: string, fallback: number): number {
  const value = Number(stringOption(args, name, String(fallback)));
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return value;
}

function help(): string {
  return `TraceLens — real-user performance debugging

Usage
  tracelens studio [--host 127.0.0.1] [--port 4173]
  tracelens inspect <trace.json>
  tracelens compare <before> <after> [--file trace.json]
  tracelens doctor
  tracelens privacy audit [--file trace.json] [--endpoint URL]
  tracelens budget check [--config tracelens.yml] [--file trace.json]
    [--release VERSION] [--app NAME] [--environment NAME] [--format text|json]
  tracelens sourcemaps upload <dist> --app NAME --release VERSION --url-prefix URL
    [--store .tracelens/sourcemaps] [--repository https://github.com/OWNER/REPO --commit SHA]

Options
  -h, --help       Show command help
  -v, --version    Show the CLI version
  --file           Read comparison events from a trace file
  --endpoint       Read events from a running Studio collector`;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(
      `TraceLens: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
