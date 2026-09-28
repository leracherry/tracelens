import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  AnyTraceLensEvent,
  CustomSpanPayload,
  InteractionPayload,
  LayoutShiftPayload,
  LongFramePayload,
  NetworkPayload,
  ReactRenderPayload,
} from '@tracelens/protocol';
import './styles.css';
import { aggregateReactRenders } from './react-work';
import { filterByRelease, listReleases } from './release-selection';

function App() {
  const [events, setEvents] = useState<AnyTraceLensEvent[]>([]);
  const [selected, setSelected] = useState<string>();
  const [selectedRelease, setSelectedRelease] = useState('all');

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/__tracelens');
      setEvents((await response.json()) as AnyTraceLensEvent[]);
    };
    void load();
    const timer = window.setInterval(() => void load(), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const releases = useMemo(() => listReleases(events), [events]);
  const visibleEvents = useMemo(
    () => filterByRelease(events, selectedRelease),
    [events, selectedRelease],
  );
  const interactions = useMemo(
    () =>
      visibleEvents.filter((event) => event.type === 'interaction') as Array<
        AnyTraceLensEvent & { payload: InteractionPayload }
      >,
    [visibleEvents],
  );
  const active =
    interactions.find((event) => event.id === selected) ?? interactions.at(-1);
  const frames = visibleEvents.filter(
    (event) => event.type === 'long-frame',
  ) as Array<AnyTraceLensEvent & { payload: LongFramePayload }>;
  const networks = visibleEvents.filter(
    (event) => event.type === 'network',
  ) as Array<AnyTraceLensEvent & { payload: NetworkPayload }>;
  const shifts = visibleEvents.filter(
    (event) => event.type === 'layout-shift',
  ) as Array<AnyTraceLensEvent & { payload: LayoutShiftPayload }>;
  const spans = visibleEvents.filter(
    (event) => event.type === 'custom-span',
  ) as Array<AnyTraceLensEvent & { payload: CustomSpanPayload }>;
  const reactRenders = visibleEvents.filter(
    (event) => event.type === 'react-render',
  ) as Array<AnyTraceLensEvent & { payload: ReactRenderPayload }>;
  const inp = Math.max(
    0,
    ...interactions.map((event) => event.payload.duration),
  );

  return (
    <div className="shell">
      <header>
        <div className="brand">
          <span className="mark">TL</span> TraceLens
        </div>
        <div className="context">
          <span className="live" /> local <span>/</span>
          <label className="release-filter">
            <span>Release</span>
            <select
              aria-label="Filter by release"
              value={selectedRelease}
              onChange={(event) => {
                setSelectedRelease(event.target.value);
                setSelected(undefined);
              }}
            >
              <option value="all">All releases</option>
              {releases.map((release) => (
                <option value={release.release} key={release.release}>
                  {release.release}
                  {release.commit ? ` · ${release.commit}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <aside>
        <p className="eyebrow">Workspace</p>
        <nav>
          <a className="active">Interactions</a>
          <a>Sessions</a>
          <a>Releases</a>
        </nav>
        <div className="capture">
          <span className="pulse" /> Capturing locally
          <br />
          <small>
            {visibleEvents.length}
            {selectedRelease === 'all' ? '' : ` of ${events.length}`} telemetry
            events
          </small>
        </div>
      </aside>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">Interaction health</p>
            <h1>See where the frame went.</h1>
            <p className="muted">
              Real browser timings, correlated into one debugging view.
            </p>
          </div>
          <div className="metric">
            <span>INP max</span>
            <strong>
              {Math.round(inp)}
              <small> ms</small>
            </strong>
            <em className={inp > 200 ? 'warn' : 'good'}>
              {inp ? (inp > 200 ? 'needs work' : 'good') : 'waiting'}
            </em>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Captured interactions</p>
              <h2>Slowest first</h2>
            </div>
            <span>{interactions.length} traces</span>
          </div>
          {interactions.length === 0 ? (
            <div className="empty">
              <div className="scope" />
              <h3>Waiting for an interaction</h3>
              <p>
                Open the playground at <code>localhost:4174</code> and click
                “Save settings”.
              </p>
            </div>
          ) : (
            <div className="trace-grid">
              <div className="trace-list">
                {[...interactions]
                  .sort((a, b) => b.payload.duration - a.payload.duration)
                  .map((event) => (
                    <button
                      className={
                        active?.id === event.id ? 'trace selected' : 'trace'
                      }
                      key={event.id}
                      onClick={() => setSelected(event.id)}
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
                <Detail
                  interaction={active.payload}
                  frames={frames.map((event) => event.payload)}
                  networks={networks.map((event) => event.payload)}
                  shifts={shifts.map((event) => event.payload)}
                  spans={spans.map((event) => event.payload)}
                  reactRenders={reactRenders.map((event) => event.payload)}
                />
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Detail({
  interaction,
  frames,
  networks,
  shifts,
  spans,
  reactRenders,
}: {
  interaction: InteractionPayload;
  frames: LongFramePayload[];
  networks: NetworkPayload[];
  shifts: LayoutShiftPayload[];
  spans: CustomSpanPayload[];
  reactRenders: ReactRenderPayload[];
}) {
  const timing = interaction.timing;
  const segments = [
    ['Input delay', timing.inputDelay, 'input'],
    ['Processing', timing.processingDuration, 'script'],
    ['Presentation', timing.presentationDelay, 'paint'],
  ] as const;
  const overlaps = (startTime: number, duration: number) =>
    startTime <= interaction.startTime + interaction.duration &&
    startTime + duration >= interaction.startTime;
  const relevantFrames = frames.filter(
    (frame) =>
      frame.interactionId === interaction.interactionId ||
      overlaps(frame.startTime, frame.duration),
  );
  const relevantNetworks = networks.filter(
    (network) =>
      network.interactionId === interaction.interactionId ||
      overlaps(network.startTime, network.duration),
  );
  const relevantShifts = shifts.filter(
    (shift) =>
      shift.interactionId === interaction.interactionId ||
      overlaps(shift.startTime, shift.duration),
  );
  const relevantSpans = spans.filter((span) =>
    overlaps(span.startTime, span.duration),
  );
  const relevantReactRenders = reactRenders.filter(
    (render) =>
      render.interactionId === interaction.interactionId ||
      overlaps(render.startTime, render.duration),
  );
  const primary = [
    ...relevantFrames.map((frame) => ({
      label: 'Long animation frame',
      value: frame.duration,
    })),
    ...relevantNetworks.map((network) => ({
      label: `${network.method} ${compactUrl(network.url)}`,
      value: network.duration,
    })),
    ...relevantSpans.map((span) => ({
      label: span.name,
      value: span.duration,
    })),
    ...relevantReactRenders.map((render) => ({
      label: render.component,
      value: render.duration,
    })),
  ].sort((a, b) => b.value - a.value)[0];
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">Interaction trace</p>
          <h2>{interaction.name}</h2>
        </div>
        <strong>
          {Math.round(interaction.duration)}
          <small> ms</small>
        </strong>
      </div>
      <div className="timeline">
        {segments.map(([name, duration, className]) => (
          <div
            key={name}
            className={className}
            style={{
              width: `${Math.max(4, (duration / timing.total) * 100)}%`,
            }}
          >
            <span>{name}</span>
            <b>{Math.round(duration)} ms</b>
          </div>
        ))}
      </div>
      <div className="breakdown">
        {segments.map(([name, duration]) => (
          <div key={name}>
            <span>{name}</span>
            <b>{Math.round(duration)} ms</b>
          </div>
        ))}
      </div>
      <div className="attribution">
        <div>
          <p className="eyebrow">Primary contributor</p>
          <strong>{primary?.label ?? 'Browser presentation'}</strong>
        </div>
        <b>{Math.round(primary?.value ?? timing.presentationDelay)} ms</b>
      </div>
      <TraceTimeline
        interaction={interaction}
        frames={relevantFrames}
        networks={relevantNetworks}
        shifts={relevantShifts}
        spans={relevantSpans}
        reactRenders={relevantReactRenders}
      />
      <ReactWork renders={relevantReactRenders} />
      <div className="frame">
        <p className="eyebrow">Long animation frames</p>
        {relevantFrames.length ? (
          relevantFrames.map((frame, index) => (
            <div className="frame-row" key={index}>
              <span>Frame #{index + 1}</span>
              <strong>{Math.round(frame.duration)} ms</strong>
              <em>{Math.round(frame.blockingDuration ?? 0)} ms blocking</em>
            </div>
          ))
        ) : (
          <p className="muted">
            No overlapping long frame reported by this browser.
          </p>
        )}
      </div>
    </div>
  );
}

function TraceTimeline({
  interaction,
  frames,
  networks,
  shifts,
  spans,
  reactRenders,
}: {
  interaction: InteractionPayload;
  frames: LongFramePayload[];
  networks: NetworkPayload[];
  shifts: LayoutShiftPayload[];
  spans: CustomSpanPayload[];
  reactRenders: ReactRenderPayload[];
}) {
  const itemStyle = (startTime: number, duration: number) => {
    const left = Math.max(
      0,
      ((startTime - interaction.startTime) / interaction.duration) * 100,
    );
    const width = Math.max(1.5, (duration / interaction.duration) * 100);
    const clampedLeft = Math.min(98.5, left);
    return {
      left: `${clampedLeft}%`,
      width: `${Math.max(1.5, Math.min(100 - clampedLeft, width))}%`,
    };
  };
  const lanes = [
    {
      name: 'Browser',
      items: frames.map((frame, index) => ({
        key: `frame-${index}`,
        label: `${Math.round(frame.duration)} ms frame`,
        className: 'lane-frame',
        startTime: frame.startTime,
        duration: frame.duration,
      })),
    },
    {
      name: 'React',
      items: reactRenders.map((render, index) => ({
        key: `react-${index}`,
        label: `${render.component} ${render.duration.toFixed(1)} ms`,
        className: 'lane-react',
        startTime: render.startTime,
        duration: render.duration,
      })),
    },
    {
      name: 'Custom',
      items: spans.map((span, index) => ({
        key: `span-${index}`,
        label: span.name,
        className: 'lane-span',
        startTime: span.startTime,
        duration: span.duration,
      })),
    },
    {
      name: 'Network',
      items: networks.map((network, index) => ({
        key: `network-${index}`,
        label: `${network.method} ${compactUrl(network.url)}`,
        className: 'lane-network',
        startTime: network.startTime,
        duration: network.duration,
      })),
    },
    {
      name: 'Layout',
      items: shifts.map((shift, index) => ({
        key: `shift-${index}`,
        label: `CLS +${shift.value.toFixed(3)}`,
        className: 'lane-shift',
        startTime: shift.startTime,
        duration: Math.max(4, shift.duration),
      })),
    },
  ];
  return (
    <section className="trace-timeline">
      <div className="timeline-heading">
        <p className="eyebrow">Correlated timeline</p>
        <span>0 ms</span>
        <span>{Math.round(interaction.duration)} ms</span>
      </div>
      {lanes.map((lane) => (
        <div className="lane" key={lane.name}>
          <label>{lane.name}</label>
          <div className="lane-track">
            {lane.items.map((item) => (
              <div
                title={item.label}
                key={item.key}
                className={`lane-item ${item.className}`}
                style={itemStyle(item.startTime, item.duration)}
              >
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ReactWork({ renders }: { renders: ReactRenderPayload[] }) {
  const components = aggregateReactRenders(renders);

  return (
    <section className="react-work">
      <div className="section-heading">
        <p className="eyebrow">React work</p>
        <span>{components.length} components</span>
      </div>
      {components.length ? (
        <div className="component-table">
          <div className="component-row component-header">
            <span>Component</span>
            <span>Phase</span>
            <span>Renders</span>
            <span>Time</span>
          </div>
          {components.map((component) => (
            <div className="component-row" key={component.component}>
              <strong>{component.component}</strong>
              <span>{component.phase}</span>
              <span>{component.count}</span>
              <b>{component.duration.toFixed(1)} ms</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          No React profiler samples are correlated with this interaction.
        </p>
      )}
    </section>
  );
}

function compactUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.pathname;
  } catch {
    return value;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
