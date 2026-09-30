import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from '@leracherry/tracelens-browser';
import { TraceLensProfiler } from '@leracherry/tracelens-react';
import './styles.css';

init({
  app: 'react-vite-example',
  endpoint: 'http://127.0.0.1:4173/__tracelens',
});

function App() {
  const [items, setItems] = useState<number[]>([]);
  return (
    <main>
      <p>TraceLens example</p>
      <h1>React render profiler</h1>
      <button
        data-tracelens-name="Render expensive list"
        onClick={() =>
          setItems(Array.from({ length: 2_000 }, (_, index) => index))
        }
      >
        Render expensive list
      </button>
      <div className="items">
        {items.map((item) => (
          <i key={item} style={{ opacity: 0.2 + (item % 5) / 7 }} />
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TraceLensProfiler name="ExampleApp">
      <App />
    </TraceLensProfiler>
  </StrictMode>,
);
