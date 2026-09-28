import { describe, expect, it } from 'vitest';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import {
  createSourceMapResolver,
  generatedPosition,
  githubSourceUrl,
  type SourceMapBundle,
} from './source-maps.js';

const bundle: SourceMapBundle = {
  version: 1,
  app: 'app',
  release: 'r1',
  repository: 'https://github.com/owner/repo',
  commit: 'abcdef123',
  artifacts: [
    {
      url: 'https://example.com/app.js',
      generated: 'run();',
      map: JSON.stringify({
        version: 3,
        sources: ['src/app.ts'],
        names: ['run'],
        mappings: 'AAAAA',
      }),
    },
  ],
};
const event: AnyTraceLensEvent = {
  version: 1,
  id: 'frame',
  timestamp: 1,
  app: 'app',
  release: 'r1',
  sessionId: 's',
  type: 'long-frame',
  payload: {
    startTime: 0,
    duration: 50,
    scripts: [
      {
        source: 'https://example.com/app.js',
        sourceCharPosition: 0,
        duration: 40,
        thirdParty: false,
      },
    ],
  },
};

describe('source maps', () => {
  it('resolves a source and pinned GitHub link without mutating input', () => {
    const resolved = createSourceMapResolver([bundle])(event);
    if (resolved.type !== 'long-frame') throw Error();
    expect(resolved.payload.scripts[0]?.originalLocation).toEqual({
      source: 'src/app.ts',
      line: 1,
      column: 1,
      name: 'run',
      githubUrl: 'https://github.com/owner/repo/blob/abcdef123/src/app.ts#L1',
    });
    expect(event.payload.scripts[0]?.originalLocation).toBeUndefined();
  });
  it('isolates app, release, commit, and exact URL', () => {
    const resolve = createSourceMapResolver([bundle]);
    for (const change of [
      { app: 'other' },
      { release: 'r2' },
      { commit: '123456789' },
    ])
      expect(resolve({ ...event, ...change })).toEqual({ ...event, ...change });
    const wrongUrl = {
      ...event,
      payload: {
        ...event.payload,
        scripts: [
          { ...event.payload.scripts[0]!, source: 'https://other.com/app.js' },
        ],
      },
    };
    expect(resolve(wrongUrl)).toEqual(wrongUrl);
  });
  it('normalizes UTF-16 offsets and line endings, rejecting unavailable offsets', () => {
    expect(generatedPosition('😀\r\nx', 4)).toEqual({ line: 2, column: 0 });
    expect(generatedPosition('a\rb', 2)).toEqual({ line: 2, column: 0 });
    for (const offset of [-1, 0.5, NaN, 3])
      expect(generatedPosition('abc', offset)).toBeUndefined();
  });
  it('does not fabricate a location for absent or unmapped positions', () => {
    const resolve = createSourceMapResolver([
      {
        ...bundle,
        artifacts: [
          {
            ...bundle.artifacts[0]!,
            map: JSON.stringify({
              version: 3,
              sources: [],
              names: [],
              mappings: '',
            }),
          },
        ],
      },
    ]);
    expect(resolve(event)).toEqual(event);
    const missing = {
      ...event,
      payload: {
        ...event.payload,
        scripts: [{ ...event.payload.scripts[0]!, sourceCharPosition: -1 }],
      },
    };
    expect(createSourceMapResolver([bundle])(missing)).toEqual(missing);
  });
  it('rejects invalid maps and duplicate releases', () => {
    expect(() => createSourceMapResolver([bundle, bundle])).toThrow(
      'Duplicate',
    );
    expect(() =>
      createSourceMapResolver([
        { ...bundle, artifacts: [{ ...bundle.artifacts[0]!, map: '{}' }] },
      ]),
    ).toThrow();
  });
  it('does not generate unsafe or ambiguous GitHub links', () => {
    for (const source of [
      '../src/a.ts',
      '/private/a.ts',
      'webpack://a.ts',
      'a/../../secret',
      'a\\b',
    ])
      expect(
        githubSourceUrl(bundle.repository, bundle.commit, source, 1),
      ).toBeUndefined();
    expect(
      githubSourceUrl(
        'https://github.com.evil.test/a/b',
        bundle.commit,
        'a.ts',
        1,
      ),
    ).toBeUndefined();
    expect(
      githubSourceUrl(bundle.repository, 'main', 'a.ts', 1),
    ).toBeUndefined();
  });
});
