import { describe, expect, it } from 'vitest';
import type { ReactRenderPayload } from '@leracherry/tracelens-protocol';
import { aggregateReactRenders } from './react-work';

function render(
  component: string,
  duration: number,
  phase: ReactRenderPayload['phase'] = 'update',
): ReactRenderPayload {
  return {
    component,
    duration,
    phase,
    baseDuration: duration,
    startTime: 0,
    commitTime: duration,
    renderCount: 1,
  };
}

describe('aggregateReactRenders', () => {
  it('totals samples and sorts the hottest component first', () => {
    expect(
      aggregateReactRenders([
        render('Checkout', 4),
        render('PriceSummary', 8),
        render('Checkout', 7),
      ]),
    ).toEqual([
      { component: 'Checkout', duration: 11, count: 2, phase: 'update' },
      { component: 'PriceSummary', duration: 8, count: 1, phase: 'update' },
    ]);
  });
});
