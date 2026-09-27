#!/usr/bin/env node
import { resolve } from 'node:path';
import { formatDoctor, runDoctor } from './doctor.js';
import { formatInteractionReport } from './format.js';
import { startStudio } from './studio.js';
import { readTraceFile } from './trace-file.js';

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<number> {
  switch (command) {
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
    case 'studio': {
      const port = numberOption(args, '--port', 4173);
      const host = stringOption(args, '--host', '127.0.0.1');
      return startStudio({ host, port });
    }
    case '--version':
    case '-v':
      console.log('tracelens 0.1.0');
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
  tracelens doctor

Options
  -h, --help       Show command help
  -v, --version    Show the CLI version`;
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
