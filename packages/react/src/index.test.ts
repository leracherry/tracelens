import { describe, expect, it } from 'vitest';
import { createReactRenderSample } from './index';

describe('createReactRenderSample', () => {
  it('preserves profiler timing and count', () => {
    expect(
      createReactRenderSample({
        component: 'Checkout',
        phase: 'mount',
        actualDuration: 12.5,
        baseDuration: 18,
        startTime: 100,
        commitTime: 120,
        renderCount: 1,
      }),
    ).toEqual({
      component: 'Checkout',
      phase: 'mount',
      duration: 12.5,
      baseDuration: 18,
      startTime: 100,
      commitTime: 120,
      renderCount: 1,
    });
  });

  it('normalizes nested updates', () => {
    expect(
      createReactRenderSample({
        component: 'Checkout',
        phase: 'nested-update',
        actualDuration: 4,
        baseDuration: 8,
        startTime: 100,
        commitTime: 108,
        renderCount: 2,
      }).phase,
    ).toBe('update');
  });
});
