import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { init, mark, trace } from '@tracelens/browser';
import { TraceBoundary, TraceLensProfiler } from '@tracelens/react';
import {
  createSearchDataset,
  scenarioById,
  scenarios,
  type ScenarioId,
} from './scenarios';
import './styles.css';

init({
  app: 'playground',
  endpoint: 'http://localhost:4173/__tracelens',
});
mark('playground-ready');

function blockMainThread(milliseconds: number) {
  const start = performance.now();
  let value = 0;
  while (performance.now() - start < milliseconds)
    value += Math.sqrt(Math.random());
  return value;
}

function App() {
  const initial = location.hash.slice(1);
  const [activeId, setActiveId] = useState<ScenarioId>(
    scenarioById(initial)?.id ?? 'search',
  );
  const [intensity, setIntensity] = useState(1);
  const active = scenarioById(activeId)!;

  useEffect(() => history.replaceState(null, '', `#${activeId}`), [activeId]);

  return (
    <div className="app-shell">
      <header>
        <div className="brand">
          <span>TL</span> TraceLens Playground
        </div>
        <div className="header-actions">
          <i>● capturing</i>
          <a href="http://localhost:4173" target="_blank">
            Open Studio ↗
          </a>
        </div>
      </header>
      <aside>
        <p className="eyebrow">Scenarios</p>
        <nav aria-label="Performance scenarios">
          {scenarios.map((scenario) => (
            <button
              className={scenario.id === activeId ? 'active' : ''}
              key={scenario.id}
              onClick={() => setActiveId(scenario.id)}
            >
              <span>{scenario.index}</span>
              <strong>{scenario.title}</strong>
              <em>{scenario.signal}</em>
            </button>
          ))}
        </nav>
        <div className="intensity">
          <label htmlFor="intensity">Load intensity</label>
          <select
            id="intensity"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          >
            <option value="0.7">0.7× moderate</option>
            <option value="1">1× slow</option>
            <option value="1.4">1.4× severe</option>
          </select>
        </div>
      </aside>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">{active.signal} experiment</p>
            <h1>{active.title}</h1>
            <span>{active.description}</span>
          </div>
          <div className="expectation">
            <small>Expected telemetry</small>
            <strong>{active.expected}</strong>
          </div>
        </section>
        <Scenario id={activeId} intensity={intensity} />
        <p className="hint">
          Run the scenario once, then open Studio and select the newest
          interaction to inspect its correlated work.
        </p>
      </main>
    </div>
  );
}

function Scenario({ id, intensity }: { id: ScenarioId; intensity: number }) {
  let content: ReactNode;
  switch (id) {
    case 'search':
      content = <SearchScenario intensity={intensity} />;
      break;
    case 'settings':
      content = <SettingsScenario intensity={intensity} />;
      break;
    case 'checkout':
      content = <CheckoutScenario intensity={intensity} />;
      break;
    case 'layout':
      content = <LayoutScenario intensity={intensity} />;
      break;
    case 'third-party':
      content = <ThirdPartyScenario intensity={intensity} />;
      break;
  }
  return <TraceBoundary name={`Scenario:${id}`}>{content}</TraceBoundary>;
}

function SearchScenario({ intensity }: { intensity: number }) {
  const dataset = useMemo(() => createSearchDataset(12_000), []);
  const [query, setQuery] = useState('report');
  const [results, setResults] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState<number>();
  async function runSearch() {
    const started = performance.now();
    const matches = await trace('filter-search-results', () => {
      blockMainThread(190 * intensity);
      return dataset.filter((item) => item.includes(query.toLowerCase()));
    });
    setResults(matches.slice(0, 30));
    setElapsed(performance.now() - started);
  }
  return (
    <ScenarioCard
      title="Search the workspace index"
      description="The filter intentionally runs synchronously on the main thread."
      action={
        <button
          data-tracelens-name="Run slow search"
          onClick={() => void runSearch()}
        >
          Run search
        </button>
      }
      status={
        elapsed
          ? `${results.length} shown · ${Math.round(elapsed)} ms`
          : 'Ready to search'
      }
    >
      <label>
        Search query
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="results" aria-live="polite">
        {results.length ? (
          results.map((result) => <span key={result}>{result}</span>)
        ) : (
          <p>Results appear here after the blocking filter completes.</p>
        )}
      </div>
    </ScenarioCard>
  );
}

function SettingsScenario({ intensity }: { intensity: number }) {
  const [status, setStatus] = useState('All changes synced');
  const [savedAt, setSavedAt] = useState('Not saved in this session');
  async function saveSettings() {
    setStatus('Serializing…');
    await trace('serialize-settings', () => {
      const model = Array.from({ length: 18_000 }, (_, index) => ({
        index,
        enabled: index % 2 === 0,
      }));
      JSON.stringify(model);
      blockMainThread(210 * intensity);
    });
    setStatus('Saving…');
    await fetch('/api/settings?workspace=acme-engineering', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region: 'ca' }),
    });
    blockMainThread(70 * intensity);
    setSavedAt(new Date().toLocaleTimeString());
    setStatus('Saved');
  }
  return (
    <ScenarioCard
      title="Workspace preferences"
      description="Serialize a large settings model, persist it, then reconcile the UI."
      action={
        <button
          data-tracelens-name="Save settings"
          onClick={() => void saveSettings()}
        >
          Save settings
        </button>
      }
      status={`${status} · ${savedAt}`}
    >
      <label>
        Workspace name
        <input defaultValue="Acme engineering" />
      </label>
      <label>
        Telemetry region
        <select defaultValue="ca">
          <option value="ca">Canada</option>
          <option value="us">United States</option>
          <option value="eu">Europe</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" defaultChecked /> Capture slow interactions
        automatically
      </label>
    </ScenarioCard>
  );
}

function CheckoutScenario({ intensity }: { intensity: number }) {
  const [items, setItems] = useState<number[]>([]);
  const [status, setStatus] = useState('Cart ready');
  async function placeOrder() {
    setStatus('Authorizing payment…');
    blockMainThread(55 * intensity);
    await fetch(`/api/checkout?intensity=${intensity}`, { method: 'POST' });
    setStatus('Rendering confirmation…');
    await trace('render-order-confirmation', () =>
      blockMainThread(125 * intensity),
    );
    setItems(
      Array.from({ length: Math.round(180 * intensity) }, (_, index) => index),
    );
    setStatus('Order confirmed');
  }
  return (
    <ScenarioCard
      title="Checkout confirmation"
      description="Wait for a slow request, then mount an intentionally wide receipt tree."
      action={
        <button
          data-tracelens-name="Place order"
          onClick={() => void placeOrder()}
        >
          Place order
        </button>
      }
      status={status}
    >
      <div className="order">
        <div>
          <span>Developer plan</span>
          <b>$29.00</b>
        </div>
        <div>
          <span>Observability add-on</span>
          <b>$12.00</b>
        </div>
        <div className="total">
          <span>Total</span>
          <b>$41.00</b>
        </div>
      </div>
      <TraceBoundary name="CheckoutReceipt">
        <div className="render-fanout" aria-live="polite">
          {items.map((item) => (
            <i key={item} style={{ opacity: 0.35 + (item % 5) / 8 }} />
          ))}
        </div>
      </TraceBoundary>
    </ScenarioCard>
  );
}

function LayoutScenario({ intensity }: { intensity: number }) {
  const grid = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Grid stable');
  async function thrashLayout() {
    const elements = [...(grid.current?.children ?? [])] as HTMLElement[];
    setStatus('Recalculating layout…');
    await trace('layout-thrash', () => {
      const started = performance.now();
      let iteration = 0;
      while (performance.now() - started < 180 * intensity) {
        const element = elements[iteration % elements.length];
        if (element) {
          const height = element.offsetHeight;
          element.style.transform = `translateY(${height % 3}px)`;
        }
        iteration += 1;
      }
    });
    setStatus('Layout settled');
  }
  return (
    <ScenarioCard
      title="Dense dashboard grid"
      description="Force synchronous layout by alternating geometry reads and style writes."
      action={
        <button
          data-tracelens-name="Recalculate dashboard layout"
          onClick={() => void thrashLayout()}
        >
          Recalculate layout
        </button>
      }
      status={status}
    >
      <div className="layout-grid" ref={grid}>
        {Array.from({ length: 96 }, (_, index) => (
          <i key={index} style={{ height: 12 + (index % 5) * 5 }} />
        ))}
      </div>
    </ScenarioCard>
  );
}

function ThirdPartyScenario({ intensity }: { intensity: number }) {
  const [status, setStatus] = useState('Analytics idle');
  async function loadAnalytics() {
    setStatus('Loading analytics…');
    await trace('third-party.analytics.bootstrap', () =>
      blockMainThread(240 * intensity),
    );
    setStatus('Analytics ready');
  }
  return (
    <ScenarioCard
      title="Analytics bootstrap"
      description="Simulate a synchronous third-party bundle executing during user input."
      action={
        <button
          data-tracelens-name="Load analytics script"
          onClick={() => void loadAnalytics()}
        >
          Load analytics
        </button>
      }
      status={status}
    >
      <div className="vendor">
        <div className="vendor-logo">A</div>
        <div>
          <strong>Acme Analytics</strong>
          <span>73.4 kB · synchronous initialization</span>
        </div>
        <em>third party</em>
      </div>
      <pre>
        analytics.init({'{'} blocking: true, plugins: 14 {'}'});
      </pre>
    </ScenarioCard>
  );
}

function ScenarioCard({
  title,
  description,
  action,
  status,
  children,
}: {
  title: string;
  description: string;
  action: ReactNode;
  status: string;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>LIVE TEST</span>
      </div>
      <div className="card-body">{children}</div>
      <footer>
        <div>
          <strong>{status}</strong>
          <small>Every run is captured by the browser SDK</small>
        </div>
        {action}
      </footer>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TraceLensProfiler name="PlaygroundApp">
      <App />
    </TraceLensProfiler>
  </StrictMode>,
);
