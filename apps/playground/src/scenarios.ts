export type ScenarioId =
  'search' | 'settings' | 'checkout' | 'layout' | 'third-party';

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  signal: string;
  expected: string;
}

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'search',
    title: 'Slow search',
    signal: 'CPU',
    expected: 'Long frame · custom span',
  },
  {
    id: 'settings',
    title: 'Settings save',
    signal: 'CPU + NET',
    expected: 'INP · long frame · network',
  },
  {
    id: 'checkout',
    title: 'Slow checkout',
    signal: 'NET + RENDER',
    expected: 'Network · confirmation span',
  },
  {
    id: 'layout',
    title: 'Layout thrash',
    signal: 'LAYOUT',
    expected: 'Long frame · layout span',
  },
  {
    id: 'third-party',
    title: 'Third-party block',
    signal: 'SCRIPT',
    expected: 'Long frame · simulated analytics span',
  },
];

export function createSearchDataset(size: number): string[] {
  const nouns = ['invoice', 'workspace', 'member', 'report', 'subscription'];
  return Array.from(
    { length: size },
    (_, index) =>
      `${nouns[index % nouns.length]}-${String(index).padStart(5, '0')}`,
  );
}

export function scenarioById(id: string): ScenarioDefinition | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}
