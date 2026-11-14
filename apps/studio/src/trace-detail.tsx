import { useMemo, useState } from 'react';
import type {
  AnyTraceLensEvent,
  LongFramePayload,
  ReactRenderPayload,
  TraceLensEvent,
} from '@leracherry/tracelens-protocol';
import { aggregateReactRenders } from './react-work';

type Evidence = Extract<
  AnyTraceLensEvent,
  {
    type:
      | 'long-frame'
      | 'react-render'
      | 'custom-span'
      | 'network'
      | 'layout-shift';
  }
>;

const lanes = [
  ['Browser', 'long-frame', 'frame'],
  ['React', 'react-render', 'react'],
  ['Custom', 'custom-span', 'span'],
  ['Network', 'network', 'network'],
  ['Layout', 'layout-shift', 'shift'],
] as const;

function isCorrelated(
  event: AnyTraceLensEvent,
  interaction: TraceLensEvent<'interaction'>,
): event is Evidence {
  if (
    event.sessionId !== interaction.sessionId ||
    event.app !== interaction.app ||
    event.release !== interaction.release ||
    (event.environment &&
      interaction.environment &&
      event.environment !== interaction.environment) ||
    (event.timeOrigin !== undefined &&
      interaction.timeOrigin !== undefined &&
      event.timeOrigin !== interaction.timeOrigin)
  )
    return false;

  switch (event.type) {
    case 'long-frame':
    case 'react-render':
    case 'custom-span':
    case 'network':
    case 'layout-shift': {
      const payload = event.payload;
      const trace = interaction.payload;
      return (
        ('interactionId' in payload &&
          payload.interactionId === trace.interactionId) ||
        (payload.startTime <= trace.startTime + trace.duration &&
          payload.startTime + payload.duration >= trace.startTime)
      );
    }
    default:
      return false;
  }
}

function labelFor(event: Evidence) {
  switch (event.type) {
    case 'long-frame':
      return 'Long animation frame';
    case 'react-render':
      return event.payload.component;
    case 'custom-span':
      return event.payload.name;
    case 'network': {
      const { method, url } = event.payload;
      try {
        return `${method} ${new URL(url).pathname}`;
      } catch {
        return `${method} ${url}`;
      }
    }
    case 'layout-shift':
      return `Layout shift +${event.payload.value.toFixed(3)}`;
  }
}

export function TraceDetail({
  interaction,
  events,
}: {
  interaction: TraceLensEvent<'interaction'>;
  events: readonly AnyTraceLensEvent[];
}) {
  const trace = interaction.payload;
  const segments = [
    ['Input delay', trace.timing.inputDelay],
    ['Processing', trace.timing.processingDuration],
    ['Presentation', trace.timing.presentationDelay],
  ] as const;
  const evidence = useMemo(
    () => events.filter((event) => isCorrelated(event, interaction)),
    [events, interaction],
  );
  const frames = evidence.filter((event) => event.type === 'long-frame');
  const renders = evidence.filter((event) => event.type === 'react-render');
  const longest = evidence.reduce<Evidence | undefined>(
    (current, event) =>
      !current || event.payload.duration > current.payload.duration
        ? event
        : current,
    undefined,
  );

  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <h2 tabIndex={-1}>{trace.name}</h2>
          <p className="trace-context">
            {trace.route}
            {interaction.release ? ` · ${interaction.release}` : ''}
          </p>
        </div>
        <strong>
          {Math.round(trace.duration)} <small>ms</small>
        </strong>
      </div>
      <div className="breakdown">
        {segments.map(([name, duration]) => (
          <div key={name}>
            <span>{name}</span>
            <b>{Math.round(duration)} ms</b>
          </div>
        ))}
      </div>
      <TraceTimeline interaction={trace} evidence={evidence} />
      {longest && (
        <div className="attribution">
          <div>
            <p className="eyebrow">Longest correlated event</p>
            <strong>{labelFor(longest)}</strong>
          </div>
          <b>{Math.round(longest.payload.duration)} ms</b>
        </div>
      )}
      <ReactWork renders={renders.map((event) => event.payload)} />
      <section className="frame" aria-label="Long animation frames">
        <h3 className="eyebrow">Long animation frames</h3>
        {frames.length ? (
          frames.map(({ id, payload }, index) => (
            <div className="frame-row" key={id}>
              <span>Frame #{index + 1}</span>
              <strong>{Math.round(payload.duration)} ms</strong>
              {payload.blockingDuration !== undefined && (
                <em>{Math.round(payload.blockingDuration)} ms blocking</em>
              )}
              <FrameSources frame={payload} />
            </div>
          ))
        ) : (
          <p className="muted">
            No overlapping long frame reported by this browser.
          </p>
        )}
      </section>
    </div>
  );
}

function TraceTimeline({
  interaction,
  evidence,
}: {
  interaction: TraceLensEvent<'interaction'>['payload'];
  evidence: Evidence[];
}) {
  const [selected, setSelected] = useState<string>();
  const active = evidence.find((event) => event.id === selected);
  const { startTime, duration } = interaction;

  function position(offset: number) {
    return duration > 0
      ? Math.max(0, Math.min(100, (offset / duration) * 100))
      : 0;
  }

  return (
    <section className="trace-timeline" aria-labelledby="timeline-title">
      <h3 className="eyebrow" id="timeline-title">
        Correlated timeline
      </h3>
      {evidence.length ? (
        <>
          <div className="timeline-axis" aria-hidden="true">
            <span>0 ms</span>
            <span>{Math.round(duration)} ms</span>
          </div>
          {lanes.map(([name, type, className]) => {
            const items = evidence.filter((event) => event.type === type);
            if (!items.length) return null;
            return (
              <div className="lane" key={type}>
                <span className="lane-label">{name}</span>
                <div className="lane-tracks">
                  {items.map((event) => {
                    const label = labelFor(event);
                    const offset = event.payload.startTime - startTime;
                    const left = position(offset);
                    const width =
                      position(offset + event.payload.duration) - left;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`lane-track lane-${className}`}
                        aria-label={`${name}: ${label}, ${event.payload.duration} ms`}
                        aria-pressed={event.id === selected}
                        aria-controls="timeline-evidence"
                        title={label}
                        onClick={() => setSelected(event.id)}
                      >
                        <span
                          className="lane-item"
                          style={{
                            left: `min(${left}%, calc(100% - 1px))`,
                            width: `${width}%`,
                          }}
                        >
                          <span>{label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div id="timeline-evidence" className="timeline-evidence">
            <div role="status">
              {active ? (
                <p>
                  <strong>{labelFor(active)}</strong>
                  {' · Start offset '}
                  {Number((active.payload.startTime - startTime).toFixed(3))} ms
                  {' · Duration '}
                  {active.payload.duration} ms
                </p>
              ) : (
                <p className="muted">
                  Select a timeline event to inspect its timing and details.
                </p>
              )}
            </div>
            {active && <EvidenceDetails event={active} />}
          </div>
        </>
      ) : (
        <p className="muted">
          No correlated events are available for this capture.
        </p>
      )}
    </section>
  );
}

function EvidenceDetails({ event }: { event: Evidence }) {
  switch (event.type) {
    case 'long-frame':
      return (
        <>
          {event.payload.blockingDuration !== undefined && (
            <p>Blocking time {event.payload.blockingDuration} ms</p>
          )}
          <FrameSources frame={event.payload} />
        </>
      );
    case 'network':
      return (
        <p>
          <code>
            {event.payload.method} {event.payload.url}
          </code>
          {' · '}
          {event.payload.transport}
          {' · '}
          {event.payload.status === undefined
            ? 'Status unavailable'
            : `HTTP ${event.payload.status}`}
        </p>
      );
    case 'react-render':
      return (
        <p>
          Phase {event.payload.phase} · Render count {event.payload.renderCount}
        </p>
      );
    case 'custom-span':
      return <p>Status {event.payload.status}</p>;
    case 'layout-shift':
      return (
        <p>
          Shift score {event.payload.value} · Recent input{' '}
          {event.payload.hadRecentInput ? 'yes' : 'no'}
        </p>
      );
  }
}

function FrameSources({ frame }: { frame: LongFramePayload }) {
  if (!frame.scripts.length)
    return <p className="muted">No script sources reported.</p>;
  return (
    <ul className="frame-sources">
      {frame.scripts.map((script, index) => {
        const location = script.originalLocation;
        const label = location
          ? `${location.source}:${location.line}:${location.column}`
          : (script.source ?? script.functionName ?? 'Unknown script');
        const link = location?.githubUrl;
        const safeLink =
          link &&
          /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/blob\/[a-f0-9]{7,40}\//i.test(
            link,
          );
        return (
          <li key={index}>
            {safeLink ? (
              <a href={link} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ) : (
              <span>{label}</span>
            )}
            {' · '}
            {Math.round(script.duration)} ms
            {!location && <small> (source unresolved)</small>}
          </li>
        );
      })}
    </ul>
  );
}
function ReactWork({ renders }: { renders: ReactRenderPayload[] }) {
  const components = aggregateReactRenders(renders);

  return (
    <section className="react-work">
      <div className="section-heading">
        <p className="eyebrow">React work</p>
        <span>
          {components.length}{' '}
          {components.length === 1 ? 'component' : 'components'}
        </span>
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
