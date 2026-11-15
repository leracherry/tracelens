import { useId, useMemo } from 'react';
import { Dropdown } from '@leracherry/tracelens-ui/dropdown';
import {
  compareReleases,
  type ComponentPerformanceDelta,
  type PerformanceDelta,
  type ReleaseComparison,
  type ScopePerformanceDelta,
} from '@leracherry/tracelens-core';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';
import type { ReleaseOption } from './release-selection';
import { classifyDelta } from './release-delta';

export interface CaptureScope {
  release: string;
  route: string;
  interaction?: string;
  comparisonRow: string;
}

export type ComparisonTable = 'interaction' | 'route' | 'component';

interface Pagination {
  pages: Partial<Record<ComparisonTable, number>>;
  onPageChange: (table: ComparisonTable, page: number) => void;
}

interface Props extends Pagination {
  events: readonly AnyTraceLensEvent[];
  releases: readonly ReleaseOption[];
  baseline: string;
  candidate: string;
  onBaselineChange: (value: string) => void;
  onCandidateChange: (value: string) => void;
  onViewCaptures: (scope: CaptureScope, button: HTMLButtonElement) => void;
  connection: 'loading' | 'ready' | 'error';
}

export function ReleaseComparisonView({
  events,
  releases,
  baseline,
  candidate,
  onBaselineChange,
  onCandidateChange,
  onViewCaptures,
  connection,
  pages,
  onPageChange,
}: Props) {
  const comparison = useMemo(() => {
    if (!baseline || !candidate || baseline === candidate) return undefined;
    if (
      !releases.some((release) => release.release === baseline) ||
      !releases.some((release) => release.release === candidate)
    )
      return undefined;
    return compareReleases(events, baseline, candidate);
  }, [baseline, candidate, events, releases]);
  const state =
    connection === 'loading'
      ? [
          'Connecting to the local collector',
          'Release comparisons appear when captures arrive.',
        ]
      : connection === 'error' && events.length === 0
        ? [
            'Collector unavailable',
            'Start the local collector. Studio retries automatically.',
          ]
        : releases.length < 2
          ? [
              'Two captured releases are needed',
              'Capture telemetry from two builds to compare performance.',
            ]
          : !baseline || !candidate
            ? [
                'Choose a baseline and candidate',
                'Select the two builds you want to compare.',
              ]
            : baseline === candidate
              ? [
                  'Choose two different releases',
                  'Select a different baseline or candidate to calculate deltas.',
                ]
              : [
                  'Selected release is unavailable',
                  'Choose another release from the current captures.',
                ];

  return (
    <main className="comparison-view">
      <div>
        <h1 id="release-heading" tabIndex={-1}>
          Releases
        </h1>
        <p className="muted comparison-description">
          Compare performance across captured builds.
        </p>
      </div>
      <div className="panel comparison-toolbar">
        <div className="release-pickers">
          <ReleasePicker
            label="Baseline"
            summary={comparison?.before}
            value={baseline}
            releases={releases}
            onChange={onBaselineChange}
          />
          <span className="compare-arrow" aria-hidden="true">
            <span className="ui-icon ui-icon-arrow" />
          </span>
          <ReleasePicker
            label="Candidate"
            summary={comparison?.after}
            value={candidate}
            releases={releases}
            onChange={onCandidateChange}
          />
        </div>
        {connection === 'error' && events.length > 0 && (
          <p className="stale-notice">Showing the last successful capture.</p>
        )}
      </div>
      {comparison ? (
        <Comparison
          comparison={comparison}
          onViewCaptures={onViewCaptures}
          pages={pages}
          onPageChange={onPageChange}
        />
      ) : (
        <section className="panel comparison-empty">
          <h2>{state[0]}</h2>
          <p className="muted">{state[1]}</p>
        </section>
      )}
    </main>
  );
}

function ReleasePicker({
  label,
  value,
  releases,
  onChange,
  summary,
}: {
  label: string;
  summary?: ReleaseComparison['before'];
  value: string;
  releases: readonly ReleaseOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const commit = releases.find((release) => release.release === value)?.commit;
  return (
    <div className="release-picker">
      <label htmlFor={id}>{label}</label>
      <Dropdown
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: 'Select release' },
          ...releases.map(({ release }) => ({
            value: release,
            label: release,
          })),
          ...(value && !releases.some(({ release }) => release === value)
            ? [{ value, label: `${value} (unavailable)` }]
            : []),
        ]}
      />
      {(commit || summary) && (
        <span className="picker-samples">
          {commit && <code>Commit {commit}</code>}
          {summary && (
            <span>
              {plural(summary.interactionCount, 'interaction')} ·{' '}
              {plural(summary.sessionCount, 'session')}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function Comparison({
  comparison,
  onViewCaptures,
  pages,
  onPageChange,
}: Pagination & {
  comparison: ReleaseComparison;
  onViewCaptures: Props['onViewCaptures'];
}) {
  const regressions = comparison.interactions.filter(
    (delta) => classifyDelta(delta) === 'regression',
  ).length;
  const newInteractions = comparison.interactions.filter(
    (delta) => classifyDelta(delta) === 'new',
  ).length;
  const hasComparableInteractions = comparison.interactions.some(
    (delta) => delta.percent !== undefined,
  );
  const release = comparison.after.release;
  return (
    <>
      <section className="comparison-metrics" aria-label="Release metrics">
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
          label="Long frames per session"
          delta={comparison.metrics.longFramesPerSession}
          digits={1}
        />
      </section>
      <section
        className={`regression-summary${regressions ? ' has-regressions' : ''}`}
        aria-label="Comparison summary"
      >
        <strong>
          {regressions
            ? `${plural(regressions, 'interaction regression')} detected`
            : hasComparableInteractions
              ? 'No interaction regressions above 5%'
              : 'No comparable interaction percentages'}
        </strong>
        <span>
          {plural(newInteractions, 'new interaction')} ·{' '}
          {plural(comparison.newLongFrames, 'additional long frame')}
        </span>
      </section>
      <DeltaTable
        title="Interaction deltas"
        kind="interaction"
        requestedPage={pages.interaction ?? 0}
        onPageChange={onPageChange}
        rows={comparison.interactions}
        release={release}
        onViewCaptures={onViewCaptures}
      />
      <DeltaTable
        title="Route deltas"
        kind="route"
        requestedPage={pages.route ?? 0}
        onPageChange={onPageChange}
        rows={comparison.routes}
        release={release}
        onViewCaptures={onViewCaptures}
      />
      <DeltaTable
        title="Component deltas"
        kind="component"
        requestedPage={pages.component ?? 0}
        onPageChange={onPageChange}
        rows={comparison.components}
      />
    </>
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
      <h2>{label}</h2>
      <div className="metric-values">
        <strong>
          <span className="visually-hidden">Baseline </span>
          {formatValue(delta.before, unit, digits)}
        </strong>
        <span className="metric-arrow" aria-hidden="true">
          <span className="ui-icon ui-icon-arrow" />
        </span>
        <strong>
          <span className="visually-hidden">Candidate </span>
          {formatValue(delta.after, unit, digits)}
        </strong>
      </div>
      <DeltaStatus delta={delta} />
    </article>
  );
}

type DeltaTableProps = {
  requestedPage: number;
  onPageChange: Pagination['onPageChange'];
} & (
  | {
      title: string;
      kind: 'component';
      rows: readonly ComponentPerformanceDelta[];
    }
  | {
      title: string;
      kind: 'route' | 'interaction';
      rows: readonly ScopePerformanceDelta[];
      release: string;
      onViewCaptures: Props['onViewCaptures'];
    }
);

function DeltaTable(props: DeltaTableProps) {
  const { title, kind, rows } = props;
  const extra = kind === 'component' ? 'Renders' : 'Evidence';
  const pageSize = 25;
  const pageCount = Math.ceil(rows.length / pageSize);
  const page = Math.min(props.requestedPage, Math.max(0, pageCount - 1));
  const offset = page * pageSize;
  const visibleRows: (ScopePerformanceDelta | ComponentPerformanceDelta)[] =
    rows.slice(offset, offset + pageSize);

  return (
    <section className="panel delta-panel" aria-labelledby={`${kind}-deltas`}>
      <div className="panel-title">
        <h2 id={`${kind}-deltas`}>{title}</h2>
        <span>{plural(rows.length, kind)}</span>
      </div>
      {rows.length ? (
        <table
          className="delta-table"
          role="table"
          aria-labelledby={`${kind}-deltas`}
        >
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {kind}
              </th>
              {['Baseline', 'Candidate', 'Delta', extra].map((label) => (
                <th scope="col" role="columnheader" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {visibleRows.map((row) => {
              const route = row.route ?? row.name;
              const comparisonRow = JSON.stringify([kind, row.key]);
              return (
                <tr role="row" className={classifyDelta(row)} key={row.key}>
                  <th scope="row" role="rowheader">
                    {row.name}
                    {row.route !== undefined && <small>{row.route}</small>}
                  </th>
                  <DeltaCell label="Baseline">
                    {formatValue(
                      row.before,
                      'ms',
                      kind === 'component' ? 1 : 0,
                    )}
                  </DeltaCell>
                  <DeltaCell label="Candidate">
                    {formatValue(row.after, 'ms', kind === 'component' ? 1 : 0)}
                  </DeltaCell>
                  <DeltaCell label="Delta">
                    <DeltaStatus delta={row} />
                  </DeltaCell>
                  <DeltaCell label={extra}>
                    {'beforeRenders' in row ? (
                      <span className="render-delta">
                        <span className="visually-hidden">Baseline </span>
                        {row.beforeRenders}
                        <span
                          className="ui-icon ui-icon-arrow"
                          aria-hidden="true"
                        />
                        <span className="visually-hidden">Candidate </span>
                        {row.afterRenders} ({signed(row.renderDelta)})
                      </span>
                    ) : props.kind !== 'component' &&
                      row.after !== undefined ? (
                      <button
                        className="capture-link"
                        data-comparison-row={comparisonRow}
                        aria-label={`View captures for ${row.name}${kind === 'interaction' ? ` on ${route}` : ''}`}
                        onClick={(event) =>
                          props.onViewCaptures(
                            {
                              release: props.release,
                              route,
                              interaction:
                                kind === 'interaction' ? row.name : undefined,
                              comparisonRow,
                            },
                            event.currentTarget,
                          )
                        }
                      >
                        <span>View captures</span>
                        <span
                          className="ui-icon ui-icon-arrow"
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <span className="muted">No candidate captures</span>
                    )}
                  </DeltaCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted delta-empty">
          {kind === 'component'
            ? 'No React profiler samples in either release.'
            : 'No interactions captured in either release.'}
        </p>
      )}
      {pageCount > 1 && (
        <div className="delta-pagination">
          <span role="status">
            Showing {offset + 1}–{offset + visibleRows.length} of {rows.length}
          </span>
          <div role="group" aria-label={`${title} pages`}>
            <button
              className="quiet-button"
              aria-label={`Previous ${kind} page`}
              disabled={page === 0}
              onClick={() => props.onPageChange(kind, page - 1)}
            >
              Previous
            </button>
            <button
              className="quiet-button"
              aria-label={`Next ${kind} page`}
              disabled={page === pageCount - 1}
              onClick={() => props.onPageChange(kind, page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DeltaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <td role="cell">
      <span className="mobile-delta-label" aria-hidden="true">
        {label}
      </span>
      {children}
    </td>
  );
}

function DeltaStatus({ delta }: { delta: PerformanceDelta }) {
  const tone = classifyDelta(delta);
  const label =
    delta.before === undefined && delta.after === undefined
      ? 'Unavailable'
      : delta.percent === undefined && delta.absolute
        ? 'Percent unavailable'
        : tone === 'neutral'
          ? 'Within threshold'
          : tone.charAt(0).toUpperCase() + tone.slice(1);
  return (
    <span className={`delta-status ${tone}`}>
      {delta.percent !== undefined && (
        <b>{signed(Math.round(delta.percent))}%</b>
      )}
      <span>{label}</span>
    </span>
  );
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function formatValue(value: number | undefined, unit: string, digits: number) {
  return value === undefined
    ? 'Unavailable'
    : `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}`;
}
