# React attribution

`@tracelens/react` records React Profiler commits and correlates them with the browser interaction that triggered the work.

## Install

```bash
pnpm add @tracelens/browser @tracelens/react
```

Initialize the browser SDK before mounting React, then wrap the application:

```tsx
import { init } from '@tracelens/browser';
import { TraceLensProfiler } from '@tracelens/react';

init({ app: 'dashboard', release: '2.14.0' });

root.render(
  <TraceLensProfiler>
    <App />
  </TraceLensProfiler>,
);
```

## Explicit boundaries

Add named boundaries around expensive product areas when root-level commit timing is too broad:

```tsx
import { TraceBoundary } from '@tracelens/react';

<TraceBoundary name="Checkout">
  <Checkout />
</TraceBoundary>;
```

Each boundary emits its actual duration, base duration, mount/update phase, commit timing, render count, and active interaction ID. Component props, state, DOM text, and user input values are not collected.

## Studio

The React lane places commits alongside long frames, custom spans, network calls, and layout shifts. The component table aggregates duration and render count for the selected interaction.

Profiler timings are development-oriented in the playground. Production React profiling requires a profiling-enabled React build; TraceLens does not patch React internals.
