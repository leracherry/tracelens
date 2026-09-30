# React + Vite example

The [complete example](https://github.com/leracherry/tracelens/tree/main/examples/react-vite) combines build metadata, browser instrumentation, and explicit React profiling boundaries.

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from '@leracherry/tracelens-browser';
import { TraceLensProfiler } from '@leracherry/tracelens-react';

init({
  app: 'react-vite-example',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TraceLensProfiler name="ExampleApp">
      <App />
    </TraceLensProfiler>
  </StrictMode>,
);
```

Use profiling boundaries around product regions rather than every leaf component. See [React attribution](../guides/react-attribution.md) for production-build requirements.
