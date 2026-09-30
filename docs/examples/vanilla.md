# Vanilla TypeScript example

The [complete example](https://github.com/leracherry/tracelens/tree/main/examples/vanilla) instruments a named interaction and explicit application span without a framework.

```ts
import { init, mark, trace } from '@leracherry/tracelens-browser';

init({
  app: 'vanilla-example',
  release: '1.0.0',
  environment: 'development',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

mark('example-ready');

document.querySelector('button')?.addEventListener('click', async () => {
  await trace('calculate-report', () => calculateReport());
});
```

Start Studio first, serve the example from a loopback origin, click **Calculate report**, and inspect the newest interaction.
