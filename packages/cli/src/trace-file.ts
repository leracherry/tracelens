import { readFile } from 'node:fs/promises';
import {
  isTraceLensEvent,
  type AnyTraceLensEvent,
} from '@leracherry/tracelens-protocol';

export async function readTraceFile(
  path: string,
): Promise<AnyTraceLensEvent[]> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Trace file is not valid JSON: ${path}`);
    }
    throw error;
  }
  return validateEvents(value);
}

export async function readTraceUrl(url: string): Promise<AnyTraceLensEvent[]> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(`Could not connect to TraceLens collector: ${url}`);
  }
  if (!response.ok) {
    throw new Error(`TraceLens collector returned HTTP ${response.status}.`);
  }
  return validateEvents(await response.json());
}

function validateEvents(value: unknown): AnyTraceLensEvent[] {
  if (!Array.isArray(value)) {
    throw new Error('Trace file must contain a JSON array of events.');
  }
  const events = value.filter(isTraceLensEvent);
  if (events.length !== value.length) {
    throw new Error(
      `Trace file contains ${value.length - events.length} invalid event${value.length - events.length === 1 ? '' : 's'}.`,
    );
  }
  return events;
}
