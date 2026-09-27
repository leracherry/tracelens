import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  AnyTraceLensEvent,
  CustomSpanPayload,
  InteractionPayload,
  LayoutShiftPayload,
  LongFramePayload,
  NetworkPayload,
} from '@tracelens/protocol';
import './styles.css';

function App() {
  const [events, setEvents] = useState<AnyTraceLensEvent[]>([]);
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    const load = async () => {
      const response = await fetch('/__tracelens');
      setEvents((await response.json()) as AnyTraceLensEvent[]);
    };
    void load();
    const timer = window.setInterval(() => void load(), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const interactions = useMemo(
    () =>
      events.filter((event) => event.type === 'interaction') as Array<
        AnyTraceLensEvent & { payload: InteractionPayload }
      >,
    [events],
  );
  const active =
    interactions.find((event) => event.id === selected) ?? interactions.at(-1);
  const frames = events.filter((event) => event.type === 'long-frame') as Array<
    AnyTraceLensEvent & { payload: LongFramePayload }
  >;
  const networks = events.filter((event) => event.type === 'network') as Array<
    AnyTraceLensEvent & { payload: NetworkPayload }
  >;
  const shifts = events.filter(
    (event) => event.type === 'layout-shift',
  ) as Array<AnyTraceLensEvent & { payload: LayoutShiftPayload }>;
  const spans = events.filter((event) => event.type === 'custom-span') as Array<
    AnyTraceLensEvent & { payload: CustomSpanPayload }
  >;
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
          <span className="live" /> local <span>/</span> playground
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
          <small>{events.length} telemetry events</small>
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
                        <span>{event.payload.route}</span>
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
}: {
  interaction: InteractionPayload;
  frames: LongFramePayload[];
  networks: NetworkPayload[];
  shifts: LayoutShiftPayload[];
  spans: CustomSpanPayload[];
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
      />
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
}: {
  interaction: InteractionPayload;
  frames: LongFramePayload[];
  networks: NetworkPayload[];
  shifts: LayoutShiftPayload[];
  spans: CustomSpanPayload[];
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
