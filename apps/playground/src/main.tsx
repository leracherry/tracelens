import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { init, mark, trace } from '@tracelens/browser';
import './styles.css';

init({
  app: 'playground',
  environment: 'local',
  release: '0.1.0-dev',
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
  const [status, setStatus] = useState('All changes synced');
  const [savedAt, setSavedAt] = useState('Not saved in this session');

  async function saveSettings() {
    setStatus('Validating…');
    await trace('validate-settings', () => blockMainThread(270));
    setStatus('Saving…');
    await new Promise((resolve) => setTimeout(resolve, 120));
    blockMainThread(95);
    setSavedAt(new Date().toLocaleTimeString());
    setStatus('Saved');
  }

  return (
    <main>
      <header>
        <div>
          <span>TL</span> TraceLens Playground
        </div>
        <a href="http://localhost:4173" target="_blank">
          Open Studio ↗
        </a>
      </header>
      <section className="intro">
        <p>INTENTIONALLY SLOW APPLICATION</p>
        <h1>Settings</h1>
        <span>Use this screen to produce a real interaction trace.</span>
      </section>
      <section className="card">
        <div>
          <h2>Workspace preferences</h2>
          <p>
            These controls simulate a production settings form with expensive
            validation and rendering work.
          </p>
        </div>
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
        <footer>
          <div>
            <strong>{status}</strong>
            <small>Last saved: {savedAt}</small>
          </div>
          <button
            data-tracelens-name="Save settings"
            onClick={() => void saveSettings()}
          >
            Save settings
          </button>
        </footer>
      </section>
      <p className="hint">
        The save action blocks the main thread for ~365 ms. TraceLens will
        capture its Event Timing and Long Animation Frame entries.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
