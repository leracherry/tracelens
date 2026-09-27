import { describe, expect, it } from 'vitest';
import { createSearchDataset, scenarioById, scenarios } from './scenarios';

describe('playground scenarios', () => {
  it('keeps stable unique identifiers', () => {
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(
      scenarios.length,
    );
  });

  it('builds deterministic search fixtures', () => {
    expect(createSearchDataset(2)).toEqual([
      'invoice-00000',
      'workspace-00001',
    ]);
  });

  it('looks up scenarios by route id', () => {
    expect(scenarioById('checkout')?.title).toBe('Slow checkout');
    expect(scenarioById('unknown')).toBeUndefined();
  });
});
