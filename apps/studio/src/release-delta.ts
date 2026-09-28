import type { PerformanceDelta } from '@tracelens/core';

export type DeltaTone =
  'regression' | 'improvement' | 'neutral' | 'new' | 'removed';

export function classifyDelta(delta: PerformanceDelta): DeltaTone {
  if (delta.before === undefined && delta.after !== undefined) return 'new';
  if (delta.before !== undefined && delta.after === undefined) return 'removed';
  if (delta.percent === undefined || Math.abs(delta.percent) <= 5)
    return 'neutral';
  return delta.percent > 0 ? 'regression' : 'improvement';
}
