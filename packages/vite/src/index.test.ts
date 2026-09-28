import { describe, expect, it } from 'vitest';
import { createBuildMetadata } from './index';

describe('createBuildMetadata', () => {
  it('creates metadata from the build environment', () => {
    expect(
      createBuildMetadata(
        {},
        {
          packageVersion: '2.14.0',
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

  it('allows every discovered value to be overridden', () => {
    expect(
      createBuildMetadata(
        {
          release: 'canary',
          commit: 'manual',
          buildTimestamp: 'manual-time',
          environment: 'preview',
        },
        {
          packageVersion: '2.14.0',
          commit: '7ac841f',
          buildTimestamp: '2026-09-27T18:00:00.000Z',
          environment: 'production',
        },
      ),
    ).toEqual({
      release: 'canary',
      commit: 'manual',
      buildTimestamp: 'manual-time',
      environment: 'preview',
    });
  });
});
