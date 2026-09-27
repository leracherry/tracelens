import { readFile } from 'node:fs/promises';
import type { AnyTraceLensEvent } from '@tracelens/protocol';

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

function isTraceLensEvent(value: unknown): value is AnyTraceLensEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    event.version === 1 &&
    typeof event.id === 'string' &&
    typeof event.timestamp === 'number' &&
    typeof event.sessionId === 'string' &&
    typeof event.app === 'string' &&
    typeof event.type === 'string' &&
    event.payload !== null &&
    typeof event.payload === 'object'
  );
}
