# React + Vite

This example demonstrates automatic Vite release metadata, browser instrumentation, and explicit React profiling boundaries.

```bash
npx @leracherry/tracelens-cli@1.0.0 studio
npm install
npm run dev
```

Open the loopback URL printed by Vite, click **Render expensive list**, then inspect the interaction and `ExampleApp` React timing in Studio.

The render cost is intentional and belongs only in this example. For production profiling requirements, read the [React guide](../../docs/guides/react-attribution.md).
