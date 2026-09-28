import { useEffect, useMemo, useState } from 'react';
import {
  compareReleases,
  type PerformanceDelta,
  type ComponentPerformanceDelta,
  type ReleaseComparison,
  type ScopePerformanceDelta,
} from '@tracelens/core';
import type { AnyTraceLensEvent } from '@tracelens/protocol';
import type { ReleaseOption } from './release-selection';
import { classifyDelta } from './release-delta';

export function ReleaseComparisonView({
  events,
  releases,
}: {
  events: readonly AnyTraceLensEvent[];
  releases: readonly ReleaseOption[];
}) {
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');

  useEffect(() => {
    setAfter((current) =>
      releases.some((release) => release.release === current)
        ? current
        : (releases[0]?.release ?? ''),
    );
    setBefore((current) =>
      releases.some((release) => release.release === current)
        ? current
        : (releases[1]?.release ?? ''),
    );
  }, [releases]);

  const comparison = useMemo(() => {
    if (!before || !after || before === after) return undefined;
    try {
      return compareReleases(events, before, after);
    } catch {
      return undefined;
    }
  }, [after, before, events]);

  return (
    <main className="comparison-view">
      <section className="comparison-hero">
        <div>
          <p className="eyebrow">ReleaseScope</p>
          <h1>Find the release that changed the frame.</h1>
          <p className="muted">
            Compare real-user responsiveness across two instrumented builds.
          </p>
        </div>
        <div className="release-pickers">
          <ReleasePicker
            label="Before"
            value={before}
            releases={releases}
            onChange={setBefore}
          />
          <span className="compare-arrow">→</span>
          <ReleasePicker
            label="After"
            value={after}
            releases={releases}
            onChange={setAfter}
          />
        </div>
      </section>
      {!comparison ? (
        <div className="panel comparison-empty">
          <div className="scope" />
          <h2>Two releases are needed</h2>
          <p className="muted">
            Capture or import telemetry from another release to calculate a
            performance diff.
          </p>
        </div>
      ) : (
        <Comparison comparison={comparison} />
      )}
    </main>
  );
}

function ReleasePicker({
  label,
  value,
  releases,
  onChange,
}: {
  label: string;
  value: string;
  releases: readonly ReleaseOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select release</option>
        {releases.map((release) => (
          <option value={release.release} key={release.release}>
            {release.release}
            {release.commit ? ` · ${release.commit}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function Comparison({ comparison }: { comparison: ReleaseComparison }) {
  const regressions = comparison.interactions.filter((delta) =>
    ['regression', 'new'].includes(classifyDelta(delta)),
  );
  return (
    <>
      <section className="comparison-metrics">
        <MetricDelta
          label="INP p75"
          delta={comparison.metrics.inpP75}
          unit="ms"
        />
        <MetricDelta
          label="LCP p75"
          delta={comparison.metrics.lcpP75}
          unit="ms"
        />
        <MetricDelta
          label="Long frames / session"
          delta={comparison.metrics.longFramesPerSession}
          digits={1}
        />
      </section>
      <section
        className={`regression-summary ${regressions.length ? 'has-regressions' : 'is-clear'}`}
      >
        <div>
          <p className="eyebrow">Regression signal</p>
          <strong>
            {regressions.length
              ? `${regressions.length} interaction ${regressions.length === 1 ? 'regression' : 'regressions'} detected`
              : 'No significant interaction regressions'}
          </strong>
        </div>
        <span>
          {comparison.newLongFrames
            ? `+${comparison.newLongFrames} new long frame${comparison.newLongFrames === 1 ? '' : 's'}`
            : 'No new long frames'}
        </span>
      </section>
      <DeltaTable title="Interaction deltas" rows={comparison.interactions} />
      <DeltaTable title="Route deltas" rows={comparison.routes} />
      <ComponentDeltaTable rows={comparison.components} />
    </>
  );
}

function ComponentDeltaTable({
  rows,
}: {
  rows: readonly ComponentPerformanceDelta[];
}) {
  return (
    <section className="panel delta-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">React attribution</p>
          <h2>Component deltas</h2>
        </div>
        <span>{rows.length} components</span>
      </div>
      {rows.length ? (
        <div className="delta-table">
          <div className="component-delta-row delta-header">
            <span>Component</span>
            <span>Before</span>
            <span>After</span>
            <span>Duration</span>
            <span>Renders</span>
          </div>
          {rows.slice(0, 12).map((row) => (
            <div
              className={`component-delta-row ${classifyDelta(row)}`}
              key={row.key}
            >
              <strong>{row.name}</strong>
              <span>{formatValue(row.before, 'ms', 1)}</span>
              <span>{formatValue(row.after, 'ms', 1)}</span>
              <b>{formatPercent(row.percent)}</b>
              <span className="render-delta">
                {row.beforeRenders} → {row.afterRenders}
                <small>
                  {row.renderDelta >= 0 ? '+' : ''}
                  {row.renderDelta}
                </small>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted delta-empty">
          No React profiler samples are shared by these releases.
        </p>
      )}
    </section>
  );
}

function MetricDelta({
  label,
  delta,
  unit = '',
  digits = 0,
}: {
  label: string;
  delta: PerformanceDelta;
  unit?: string;
  digits?: number;
}) {
  return (
    <article className={`comparison-metric ${classifyDelta(delta)}`}>
      <p className="eyebrow">{label}</p>
      <div>
        <strong>{formatValue(delta.before, unit, digits)}</strong>
        <span>→</span>
        <strong>{formatValue(delta.after, unit, digits)}</strong>
      </div>
      <b>{formatPercent(delta.percent)}</b>
    </article>
  );
}

function DeltaTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly ScopePerformanceDelta[];
}) {
  return (
    <section className="panel delta-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Release comparison</p>
          <h2>{title}</h2>
        </div>
        <span>{rows.length} scopes</span>
      </div>
      {rows.length ? (
        <div className="delta-table">
          <div className="delta-row delta-header">
            <span>Scope</span>
            <span>Before</span>
            <span>After</span>
            <span>Delta</span>
          </div>
          {rows.slice(0, 12).map((row) => (
            <div className={`delta-row ${classifyDelta(row)}`} key={row.key}>
              <div>
                <strong>{row.name}</strong>
                {row.route && <small>{row.route}</small>}
              </div>
              <span>{formatValue(row.before, 'ms')}</span>
              <span>{formatValue(row.after, 'ms')}</span>
              <b>
                {formatPercent(row.percent)}
                <small>{classifyDelta(row)}</small>
              </b>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted delta-empty">No comparable telemetry found.</p>
      )}
    </section>
  );
}

function formatValue(value: number | undefined, unit: string, digits = 0) {
  return value === undefined ? '—' : `${value.toFixed(digits)}${unit}`;
}

function formatPercent(value: number | undefined) {
  if (value === undefined) return 'new';
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
}
