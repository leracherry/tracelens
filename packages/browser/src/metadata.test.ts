import { describe, expect, it } from 'vitest';
import { resolveBuildMetadata } from './index';

describe('resolveBuildMetadata', () => {
  it('uses metadata injected by a build integration', () => {
    expect(
      resolveBuildMetadata(
        {},
        {
          release: '2.14.0',
          commit: '7ac841f',
          buildTimestamp: '2026-09-27T18:00:00.000Z',
          environment: 'production',
        },
      ),
    ).toEqual({
      release: '2.14.0',
      commit: '7ac841f',
      buildTimestamp: '2026-09-27T18:00:00.000Z',
      environment: 'production',
    });
  });

  it('prefers explicit SDK configuration', () => {
    expect(
      resolveBuildMetadata(
        { release: '2.14.1', environment: 'staging' },
        { release: '2.14.0', environment: 'production' },
      ),
    ).toMatchObject({ release: '2.14.1', environment: 'staging' });
  });
});
