import { describe, expect, it } from 'vitest';
import { classifyDelta } from './release-delta';

describe('classifyDelta', () => {
  it('flags meaningful regressions and improvements', () => {
    expect(classifyDelta({ before: 100, after: 120, percent: 20 })).toBe(
      'regression',
    );
    expect(classifyDelta({ before: 100, after: 80, percent: -20 })).toBe(
      'improvement',
    );
  });

  it('keeps noise neutral and identifies lifecycle changes', () => {
    expect(classifyDelta({ before: 100, after: 104, percent: 4 })).toBe(
      'neutral',
    );
    expect(classifyDelta({ after: 80 })).toBe('new');
    expect(classifyDelta({ before: 80 })).toBe('removed');
  });
});
