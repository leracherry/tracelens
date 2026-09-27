export type ScenarioId =
  'search' | 'settings' | 'checkout' | 'layout' | 'third-party';

export interface ScenarioDefinition {
  id: ScenarioId;
  index: string;
  title: string;
  signal: string;
  description: string;
  expected: string;
}

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'search',
    index: '01',
    title: 'Slow search',
    signal: 'CPU',
    description:
      'Synchronous filtering across a deliberately oversized local dataset.',
    expected: 'Long frame · custom span',
  },
  {
    id: 'settings',
    index: '02',
    title: 'Settings save',
    signal: 'CPU + NET',
    description: 'Blocking serialization followed by a delayed PATCH request.',
    expected: 'INP · long frame · network',
  },
  {
    id: 'checkout',
    index: '03',
    title: 'Slow checkout',
    signal: 'NET + RENDER',
    description: 'A slow API response followed by a wide React render fan-out.',
    expected: 'Network · render frame',
  },
  {
    id: 'layout',
    index: '04',
    title: 'Layout thrash',
    signal: 'LAYOUT',
    description:
      'Alternating layout reads and writes across a dense element grid.',
    expected: 'Long frame · layout shift',
  },
  {
    id: 'third-party',
    index: '05',
    title: 'Third-party block',
    signal: 'SCRIPT',
    description: 'A simulated analytics bootstrap monopolizes the main thread.',
    expected: 'Long frame · script attribution',
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
