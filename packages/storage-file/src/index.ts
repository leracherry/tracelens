import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  applyTraceQuery,
  type StorageAdapter,
  type TraceQuery,
} from '@tracelens/core';
import { isTraceLensEvent, type AnyTraceLensEvent } from '@tracelens/protocol';

export class FileStorage implements StorageAdapter {
  constructor(private readonly path: string) {}

  async append(events: readonly AnyTraceLensEvent[]): Promise<void> {
    const current = await this.read();
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(
      this.path,
      JSON.stringify([...current, ...events], null, 2),
    );
  }

  async query(query?: TraceQuery): Promise<AnyTraceLensEvent[]> {
    return applyTraceQuery(await this.read(), query);
  }

  async clear(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, '[]\n');
  }

  private async read(): Promise<AnyTraceLensEvent[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return Array.isArray(value) ? value.filter(isTraceLensEvent) : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }
}
