import type { ReactRenderPayload } from '@leracherry/tracelens-protocol';

export interface ComponentRenderSummary {
  component: string;
  duration: number;
  count: number;
  phase: ReactRenderPayload['phase'];
}

export function aggregateReactRenders(
  renders: readonly ReactRenderPayload[],
): ComponentRenderSummary[] {
  const components = new Map<string, ComponentRenderSummary>();
  for (const render of renders) {
    const current = components.get(render.component) ?? {
      component: render.component,
      duration: 0,
      count: 0,
      phase: render.phase,
    };
    current.duration += render.duration;
    current.count += 1;
    current.phase = render.phase;
    components.set(render.component, current);
  }
  return [...components.values()].sort(
    (left, right) => right.duration - left.duration,
  );
}
