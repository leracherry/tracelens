import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type {
  AnyTraceLensEvent,
  ScriptContribution,
} from '@leracherry/tracelens-protocol';

export interface SourceMapArtifact {
  url: string;
  generated: string;
  map: string;
}

export interface SourceMapBundle {
  version: 1;
  app: string;
  release: string;
  repository?: string;
  commit?: string;
  artifacts: SourceMapArtifact[];
}

/** Normalize a generated UTF-16 character offset to source-map coordinates. */
export function generatedPosition(code: string, offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset >= code.length)
    return undefined;
  let line = 1;
  let start = 0;
  for (let i = 0; i < offset; i++) {
    if (
      code[i] === '\n' ||
      code[i] === '\u2028' ||
      code[i] === '\u2029' ||
      (code[i] === '\r' && code[i + 1] !== '\n')
    ) {
      line++;
      start = i + 1;
    }
  }
  return { line, column: offset - start };
}

export function githubSourceUrl(
  repository: string | undefined,
  commit: string | undefined,
  source: string,
  line: number,
): string | undefined {
  if (
    !repository ||
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repository) ||
    !commit ||
    !/^[a-f0-9]{7,40}$/i.test(commit)
  )
    return undefined;
  // Only explicitly repository-relative source paths are eligible.
  const path = source.replace(/^\.\//, '');
  if (
    !path ||
    path.startsWith('/') ||
    path.includes(':') ||
    path.includes('\\') ||
    path.split('/').some((part) => !part || part === '..' || part === '.')
  )
    return undefined;
  return `${repository.replace(/\/$/, '')}/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}#L${line}`;
}

/** Parse maps once; never fetch scripts, source content, or maps from the network. */
export function createSourceMapResolver(bundles: SourceMapBundle[]) {
  const releases = new Map<
    string,
    {
      bundle: SourceMapBundle;
      artifacts: Map<string, { artifact: SourceMapArtifact; map: TraceMap }>;
    }
  >();
  for (const bundle of bundles) {
    if (
      bundle.version !== 1 ||
      !bundle.app ||
      !bundle.release ||
      !Array.isArray(bundle.artifacts)
    )
      throw new Error('Invalid source map bundle');
    const artifacts = new Map<
      string,
      { artifact: SourceMapArtifact; map: TraceMap }
    >();
    for (const artifact of bundle.artifacts) {
      if (artifacts.has(artifact.url))
        throw new Error('Duplicate generated URL');
      const raw = JSON.parse(artifact.map);
      if (
        raw.version !== 3 ||
        typeof raw.mappings !== 'string' ||
        !Array.isArray(raw.sources) ||
        !raw.sources.every((source: unknown) => typeof source === 'string') ||
        !Array.isArray(raw.names) ||
        !raw.names.every((name: unknown) => typeof name === 'string') ||
        typeof artifact.generated !== 'string'
      )
        throw new Error('Expected a flat v3 source map');
      artifacts.set(artifact.url, { artifact, map: new TraceMap(raw) });
    }
    const key = JSON.stringify([bundle.app, bundle.release]);
    if (releases.has(key))
      throw new Error('Duplicate app/release source map bundle');
    releases.set(key, { bundle, artifacts });
  }
  return (event: AnyTraceLensEvent): AnyTraceLensEvent => {
    if (event.type !== 'long-frame' || !event.release) return event;
    const entry = releases.get(JSON.stringify([event.app, event.release]));
    if (
      !entry ||
      (entry.bundle.commit &&
        event.commit &&
        entry.bundle.commit !== event.commit)
    )
      return event;
    return {
      ...event,
      payload: {
        ...event.payload,
        scripts: event.payload.scripts.map((script): ScriptContribution => {
          const generated = script.source
            ? entry.artifacts.get(script.source)
            : undefined;
          const position =
            generated && script.sourceCharPosition !== undefined
              ? generatedPosition(
                  generated.artifact.generated,
                  script.sourceCharPosition,
                )
              : undefined;
          if (!generated || !position) return script;
          try {
            const original = originalPositionFor(generated.map, position);
            if (
              original.source === null ||
              original.line === null ||
              original.column === null
            )
              return script;
            return {
              ...script,
              originalLocation: {
                source: original.source,
                line: original.line,
                column: original.column + 1,
                name: original.name ?? undefined,
                githubUrl: githubSourceUrl(
                  entry.bundle.repository,
                  entry.bundle.commit,
                  original.source,
                  original.line,
                ),
              },
            };
          } catch {
            return script;
          }
        }),
      },
    };
  };
}
