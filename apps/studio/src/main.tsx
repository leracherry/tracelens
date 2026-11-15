import { Dropdown } from '@leracherry/tracelens-ui/dropdown';
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import { TraceDetail } from './trace-detail';
import { StudioIcon } from './studio-icon';
import './styles.css';
import {
  ReleaseComparisonView,
  type CaptureScope,
  type ComparisonTable,
} from './release-comparison';
import { listReleases } from './release-selection';

type Theme = 'light' | 'dark';
const themeKey = 'tracelens-studio-theme';

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(themeKey);
    if (saved === 'dark' || saved === 'light') return saved;
    if (
      saved === 'system' &&
      matchMedia('(prefers-color-scheme: dark)').matches
    )
      return 'dark';
  } catch {
    // Studio still works when storage is unavailable.
  }
  return 'light';
}

function App() {
  const [theme, setTheme] = useState(readTheme);
  const [events, setEvents] = useState<AnyTraceLensEvent[]>([]);
  const [selected, setSelected] = useState<string>();
  const [baselineChoice, setBaselineChoice] = useState<string>();
  const [candidateChoice, setCandidateChoice] = useState<string>();
  const [comparisonPages, setComparisonPages] = useState<
    Partial<Record<ComparisonTable, number>>
  >({});
  const [captureScope, setCaptureScope] = useState<CaptureScope>();
  const [scopedSelection, setScopedSelection] = useState<string>();
  const comparisonReturn = useRef<{
    row: string;
    offset: number;
    scrollY: number;
  }>(null);
  const releaseFocus = useRef(false);
  const [selectedRelease, setSelectedRelease] = useState('all');
  const [route, setRoute] = useState('');
  const [search, setSearch] = useState('');
  const [retry, setRetry] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const focusTarget = useRef<'detail' | 'row' | 'heading' | null>(null);
  const workspace = useRef<HTMLElement>(null);
  const [view, setView] = useState<'interactions' | 'releases'>('interactions');
  const [connection, setConnection] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // Keep the current theme for this visit.
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    let previousSnapshot: string | undefined;
    const load = async () => {
      window.clearTimeout(timer);
      if (controller.signal.aborted) return;
      try {
        const response = await fetch('/__tracelens', {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
          ]),
        });
        if (!response.ok)
          throw new Error(`Collector returned HTTP ${response.status}`);
        const snapshot = await response.text();
        if (controller.signal.aborted) return;
        if (snapshot !== previousSnapshot) {
          setEvents(JSON.parse(snapshot) as AnyTraceLensEvent[]);
          previousSnapshot = snapshot;
        }
        setConnection('ready');
      } catch {
        if (!controller.signal.aborted) setConnection('error');
      } finally {
        if (!controller.signal.aborted) {
          timer = window.setTimeout(() => void load(), 1000);
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [retry]);

  const releases = useMemo(() => listReleases(events), [events]);
  const baseline = baselineChoice ?? releases[1]?.release ?? '';
  const candidate = candidateChoice ?? releases[0]?.release ?? '';

  useEffect(() => {
    if (releases.length < 2) return;
    setBaselineChoice((current) => current ?? releases[1]?.release);
    setCandidateChoice((current) => current ?? releases[0]?.release);
  }, [releases]);

  const allInteractions = useMemo(
    () => events.filter((event) => event.type === 'interaction'),
    [events],
  );
  const routes = useMemo(
    () =>
      [...new Set(allInteractions.map((event) => event.payload.route))].sort(),
    [allInteractions],
  );
  const searchTerm = search.trim().toLowerCase();
  const interactions = useMemo(
    () =>
      allInteractions
        .filter((event) =>
          captureScope
            ? event.release === captureScope.release &&
              event.payload.route === captureScope.route &&
              (captureScope.interaction === undefined ||
                event.payload.name === captureScope.interaction)
            : (selectedRelease === 'all' ||
                event.release === selectedRelease) &&
              (!route || event.payload.route === route) &&
              (!searchTerm ||
                event.payload.name.toLowerCase().includes(searchTerm) ||
                event.payload.route.toLowerCase().includes(searchTerm)),
        )
        .sort((a, b) => b.payload.duration - a.payload.duration),
    [allInteractions, captureScope, selectedRelease, route, searchTerm],
  );
  const active =
    interactions.find(
      (event) => event.id === (captureScope ? scopedSelection : selected),
    ) ?? interactions[0];
  const filtersActive =
    selectedRelease !== 'all' || route !== '' || search !== '';

  function updateFilters(release: string, nextRoute: string) {
    setSelectedRelease(release);
    setRoute(nextRoute);
    if (
      active &&
      active.id === selected &&
      ((release !== 'all' && active.release !== release) ||
        (nextRoute && active.payload.route !== nextRoute))
    ) {
      setSelected(undefined);
    }
    setShowDetail(false);
  }

  function viewCaptures(scope: CaptureScope, button: HTMLButtonElement) {
    setBaselineChoice(baseline);
    setCandidateChoice(candidate);
    comparisonReturn.current = {
      row: scope.comparisonRow,
      offset: button.getBoundingClientRect().top,
      scrollY: window.scrollY,
    };
    focusTarget.current = 'heading';
    setCaptureScope(scope);
    setScopedSelection(undefined);
    setShowDetail(false);
    setView('interactions');
  }

  function openReleases() {
    releaseFocus.current = Boolean(captureScope);
    setCaptureScope(undefined);
    setShowDetail(false);
    setView('releases');
  }

  useEffect(() => {
    if (view !== 'releases' || !releaseFocus.current) return;
    const previous = comparisonReturn.current;
    const button = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-comparison-row]'),
    ).find((element) => element.dataset.comparisonRow === previous?.row);
    if (button && previous) {
      button.focus({ preventScroll: true });
      window.scrollTo(
        0,
        window.scrollY + button.getBoundingClientRect().top - previous.offset,
      );
    } else {
      document
        .getElementById('release-heading')
        ?.focus({ preventScroll: true });
      window.scrollTo(0, previous?.scrollY ?? 0);
    }
    releaseFocus.current = false;
  }, [view]);

  useEffect(() => {
    if (!focusTarget.current) return;
    const selector = {
      detail: '.detail-head h2',
      row: '.trace[aria-pressed="true"]',
      heading: 'h1',
    }[focusTarget.current];
    workspace.current?.querySelector<HTMLElement>(selector)?.focus();
    if (focusTarget.current === 'heading') window.scrollTo(0, 0);
    focusTarget.current = null;
  }, [showDetail, view]);

  return (
    <div className="shell">
      <aside className="studio-sidebar workspace-sidebar">
        <div className="brand">
          <img
            className="brand-light"
            src="/brand.png"
            alt="tracelens"
            width="129"
            height="28"
          />
          <img
            className="brand-dark"
            src="/brand-dark.png"
            alt="tracelens"
            width="129"
            height="28"
          />
        </div>
        <nav aria-label="Studio views">
          <button
            className={view === 'interactions' ? 'active' : ''}
            aria-pressed={view === 'interactions'}
            onClick={() => {
              if (captureScope) {
                setCaptureScope(undefined);
                setShowDetail(false);
              }
              setView('interactions');
            }}
          >
            <StudioIcon name="activity" />
            Interactions
          </button>
          <button
            className={view === 'releases' ? 'active' : ''}
            aria-pressed={view === 'releases'}
            onClick={openReleases}
          >
            <StudioIcon name="tag" />
            Releases
          </button>
        </nav>
      </aside>
      <header className="studio-toolbar">
        <div className="context">
          <span className={`status ${connection}`} role="status">
            <span className="live" aria-hidden="true" />
            {connection === 'ready'
              ? 'Local capture'
              : connection === 'error'
                ? 'Collector offline'
                : 'Connecting'}
          </span>
          <button
            type="button"
            className="theme-control"
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
            title={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
            onClick={() =>
              setTheme((current) => (current === 'light' ? 'dark' : 'light'))
            }
          >
            <StudioIcon name={theme === 'light' ? 'dark' : 'light'} />
          </button>
        </div>
      </header>
      {view === 'interactions' ? (
        <main ref={workspace}>
          <h1
            className={captureScope ? undefined : 'visually-hidden'}
            tabIndex={-1}
          >
            {captureScope ? 'Release captures' : 'Interactions'}
          </h1>
          {connection === 'error' && (
            <div className="collector-notice">
              {events.length > 0 && (
                <p className="stale-notice">
                  Showing the last successful capture.
                </p>
              )}
              <button
                className="quiet-button"
                onClick={() => setRetry(retry + 1)}
              >
                Retry collector
              </button>
            </div>
          )}
          {captureScope && (
            <div className="capture-pivot">
              <button className="quiet-button" onClick={openReleases}>
                <span
                  className="ui-icon ui-icon-arrow ui-icon-back"
                  aria-hidden="true"
                />
                Back to comparison
              </button>
              <p>
                Candidate <strong>{captureScope.release}</strong> ·{' '}
                <code>{captureScope.route}</code>
                {captureScope.interaction !== undefined && (
                  <> · {captureScope.interaction}</>
                )}
              </p>
            </div>
          )}
          <section
            className={`panel interactions-panel${showDetail && active ? ' inspecting' : ''}`}
          >
            <div className="view-toolbar">
              {!captureScope && (
                <>
                  <label className="capture-search">
                    <span className="visually-hidden">Search captures</span>
                    <input
                      type="search"
                      placeholder="Search by name or route"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setSearch('');
                      }}
                    />
                  </label>
                  <div className="release-filter">
                    <label htmlFor="release-filter">Release</label>
                    <Dropdown
                      id="release-filter"
                      label="Filter by release"
                      value={selectedRelease}
                      onChange={(value) => updateFilters(value, route)}
                      options={[
                        { value: 'all', label: 'All releases' },
                        ...releases.map(({ release, commit }) => ({
                          value: release,
                          label: commit ? `${release} · ${commit}` : release,
                        })),
                        ...(selectedRelease !== 'all' &&
                        !releases.some(
                          ({ release }) => release === selectedRelease,
                        )
                          ? [{ value: selectedRelease, label: selectedRelease }]
                          : []),
                      ]}
                    />
                  </div>
                  <div className="release-filter">
                    <label htmlFor="route-filter">Route</label>
                    <Dropdown
                      id="route-filter"
                      label="Filter by route"
                      value={route}
                      onChange={(value) =>
                        updateFilters(selectedRelease, value)
                      }
                      options={[
                        { value: '', label: 'All routes' },
                        ...routes.map((option) => ({
                          value: option,
                          label: option,
                        })),
                        ...(route && !routes.includes(route)
                          ? [{ value: route, label: route }]
                          : []),
                      ]}
                    />
                  </div>
                  {filtersActive && (
                    <button
                      className="quiet-button"
                      onClick={() => {
                        setSearch('');
                        updateFilters('all', '');
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
              <span className="capture-summary">
                <strong>{interactions.length}</strong> captured
                {interactions[0] && (
                  <>
                    {' '}
                    · Slowest captured interaction{' '}
                    <strong>
                      {Math.round(interactions[0].payload.duration)} ms
                    </strong>
                  </>
                )}
              </span>
            </div>
            {interactions.length === 0 ? (
              <div className="empty">
                {connection === 'loading' ? (
                  <h2>Connecting to the local collector</h2>
                ) : connection === 'error' && events.length === 0 ? (
                  <>
                    <h2>Collector unavailable</h2>
                    <p>
                      Start the local collector. Studio retries automatically.
                    </p>
                  </>
                ) : captureScope ? (
                  <>
                    <h2>No matching candidate captures</h2>
                    <p>
                      The matching captures are no longer available in the
                      collector.
                    </p>
                  </>
                ) : filtersActive ? (
                  <>
                    <h2>No matching interactions</h2>
                    <p>Try a different search, release, or route.</p>
                  </>
                ) : (
                  <>
                    <h2>Waiting for an interaction</h2>
                    <p>
                      Open the playground at <code>localhost:4174</code> and
                      click “Save settings”.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="trace-grid">
                <div
                  className="trace-list"
                  role="group"
                  aria-label="Captured interactions"
                >
                  <div className="trace-list-heading">
                    <h2>Slowest first</h2>
                    <span>Duration</span>
                  </div>
                  {interactions.map((event) => (
                    <button
                      className={
                        active?.id === event.id ? 'trace selected' : 'trace'
                      }
                      key={event.id}
                      aria-pressed={active?.id === event.id}
                      onClick={() => {
                        if (captureScope) setScopedSelection(event.id);
                        else setSelected(event.id);
                        if (window.matchMedia('(max-width: 800px)').matches) {
                          focusTarget.current = 'detail';
                          setShowDetail(true);
                        }
                      }}
                    >
                      <div>
                        <strong>{event.payload.name}</strong>
                        <span>
                          {event.payload.route}
                          {event.release ? ` · ${event.release}` : ''}
                        </span>
                      </div>
                      <b>{Math.round(event.payload.duration)} ms</b>
                    </button>
                  ))}
                </div>
                {active && (
                  <div className="trace-inspector">
                    <button
                      className="quiet-button trace-back"
                      onClick={() => {
                        focusTarget.current = 'row';
                        setShowDetail(false);
                      }}
                    >
                      <span
                        className="ui-icon ui-icon-arrow ui-icon-back"
                        aria-hidden="true"
                      />
                      Back to interactions
                    </button>
                    <TraceDetail
                      key={active.id}
                      interaction={active}
                      events={events}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      ) : (
        <ReleaseComparisonView
          events={events}
          releases={releases}
          baseline={baseline}
          candidate={candidate}
          onBaselineChange={(nextBaseline) => {
            setBaselineChoice(nextBaseline);
            setComparisonPages({});
          }}
          onCandidateChange={(nextCandidate) => {
            setCandidateChoice(nextCandidate);
            setComparisonPages({});
          }}
          pages={comparisonPages}
          onPageChange={(table, page) =>
            setComparisonPages((current) => ({ ...current, [table]: page }))
          }
          onViewCaptures={viewCaptures}
          connection={connection}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
