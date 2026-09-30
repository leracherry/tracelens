import { init, mark, trace } from '@leracherry/tracelens-browser';
import './styles.css';

init({
  app: 'vanilla-example',
  release: '1.0.0',
  environment: 'development',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

mark('example-ready');

const button = document.querySelector('button');
const output = document.querySelector('output');

button?.addEventListener('click', async () => {
  const result = await trace('calculate-report', () => {
    const started = performance.now();
    let value = 0;
    while (performance.now() - started < 180) value += Math.sqrt(Math.random());
    return Math.round(value);
  });
  if (output) output.value = `Report ${result.toLocaleString()} is ready`;
});
