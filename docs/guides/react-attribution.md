# React integration

`@leracherry/tracelens-react` records React Profiler commits and correlates them with the browser interaction that triggered the work. It uses React's supported `<Profiler>` API rather than patching React internals.

## Install

```bash
npm install @leracherry/tracelens-browser @leracherry/tracelens-react
```

Initialize the browser SDK before mounting React, then wrap the application:

```tsx
import { init } from '@leracherry/tracelens-browser';
import { TraceLensProfiler } from '@leracherry/tracelens-react';

init({
  app: 'dashboard',
  release: '2.14.0',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

root.render(
  <TraceLensProfiler name="Dashboard">
    <App />
  </TraceLensProfiler>,
);
```

Initialize before the first render. The root profiler gives broad commit timing and is useful while deciding where narrower boundaries belong.

## Explicit boundaries

Add named boundaries around expensive product areas when root-level commit timing is too broad:

```tsx
import { TraceBoundary } from '@leracherry/tracelens-react';

<TraceBoundary name="Checkout">
  <Checkout />
</TraceBoundary>;
```

Each boundary emits its actual duration, base duration, mount/update phase, commit timing, render count, and active interaction ID. Component props, state, DOM text, and user input values are not collected.

Choose stable product-area names such as `CheckoutSummary`, not IDs or values from props. Boundaries can be nested when the names represent distinct questions:

```tsx
<TraceBoundary name="Checkout">
  <Cart />
  <TraceBoundary name="ShippingOptions">
    <ShippingOptions />
  </TraceBoundary>
</TraceBoundary>
```

Avoid wrapping every component. Profiler callbacks add observation work, and leaf-level boundaries create noisy traces. Start with route or feature boundaries, then narrow a confirmed hotspot.

Use `disabled` to preserve component structure while turning off collection for a region:

```tsx
<TraceBoundary name="ExperimentalGrid" disabled={!diagnosticsEnabled}>
  <Grid />
</TraceBoundary>
```

## Studio

The React lane places commits alongside long frames, custom spans, network calls, and layout shifts. The component table aggregates duration and render count for the selected interaction. A commit can overlap an interaction without consuming all of its time, so read it alongside the INP subparts and long-frame contributors.

ReleaseScope compares matching boundary names between releases. Keep names stable across builds so component deltas remain meaningful.

## Production profiling

Profiler timings are development-oriented in the playground. Production React profiling requires a profiling-enabled React build; a normal production build may omit useful timings. Follow the build tooling guidance for your React distribution and verify that a known boundary appears before relying on production comparisons.

Strict Mode can intentionally invoke extra development renders. Those samples are real profiler callbacks but do not represent production render frequency. Compare like-for-like environments.

TraceLens boundaries report region-level commit cost, not automatic fiber-level or component-self-time attribution. Use a React-specific profiler when you need a flamegraph inside a boundary.
