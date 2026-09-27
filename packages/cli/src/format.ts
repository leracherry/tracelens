import type {
  AnyTraceLensEvent,
  CustomSpanPayload,
  InteractionPayload,
  LongFramePayload,
  NetworkPayload,
} from '@tracelens/protocol';

const ESCAPE = '\u001B[';

interface Contributor {
  label: string;
  duration: number;
  detail: string;
}

export interface ReportOptions {
  color?: boolean;
}

export function formatInteractionReport(
  events: readonly AnyTraceLensEvent[],
  options: ReportOptions = {},
): string {
  const interactions = events
    .filter(isInteractionEvent)
    .sort((left, right) => right.payload.duration - left.payload.duration);
  const interaction = interactions[0];
  if (!interaction) {
    return 'No interaction events found in this trace.';
  }

  const payload = interaction.payload;
  const contributors = collectContributors(events, payload);
  const primary = contributors[0];
  const paint = (value: string, code: number) =>
    options.color ? `${ESCAPE}${code}m${value}${ESCAPE}0m` : value;
  const timing = payload.timing;
  const lines = [
    paint('TraceLens interaction', 90),
    '',
    `${paint(payload.name, 1)}  ${paint(formatDuration(payload.duration), ratingColor(payload.duration))}`,
    paint(payload.route, 90),
    '',
    row('Input delay', timing.inputDelay),
    row('Processing', timing.processingDuration),
    row('Presentation', timing.presentationDelay),
    '',
    paint('Primary contributor', 90),
    primary
      ? `${primary.label}  ${paint(formatDuration(primary.duration), 33)}`
      : `Browser presentation  ${formatDuration(timing.presentationDelay)}`,
  ];

  if (primary?.detail) lines.push(paint(primary.detail, 90));
  if (contributors.length > 1) {
    lines.push('', paint('Other correlated work', 90));
    for (const contributor of contributors.slice(1, 5)) {
      lines.push(
        `${contributor.label}  ${formatDuration(contributor.duration)}`,
      );
    }
  }

  lines.push(
    '',
    paint(
      `${interactions.length} interaction${interactions.length === 1 ? '' : 's'} · ${events.length} events`,
      90,
    ),
  );
  return lines.join('\n');
}

function collectContributors(
  events: readonly AnyTraceLensEvent[],
  interaction: InteractionPayload,
): Contributor[] {
  const overlaps = (startTime: number, duration: number) =>
    startTime <= interaction.startTime + interaction.duration &&
    startTime + duration >= interaction.startTime;
  const contributors: Contributor[] = [];
  for (const event of events) {
    if (event.type === 'long-frame') {
      const frame = event.payload as LongFramePayload;
      if (
        frame.interactionId === interaction.interactionId ||
        overlaps(frame.startTime, frame.duration)
      ) {
        const script = [...frame.scripts].sort(
          (left, right) => right.duration - left.duration,
        )[0];
        contributors.push({
          label:
            script?.functionName ||
            fileName(script?.source) ||
            'Long animation frame',
          duration: script?.duration ?? frame.duration,
          detail: `${formatDuration(frame.blockingDuration ?? 0)} blocking`,
        });
      }
    }
    if (event.type === 'network') {
      const network = event.payload as NetworkPayload;
      if (
        network.interactionId === interaction.interactionId ||
        overlaps(network.startTime, network.duration)
      ) {
        contributors.push({
          label: `${network.method} ${compactUrl(network.url)}`,
          duration: network.duration,
          detail: network.status ? `HTTP ${network.status}` : 'Request failed',
        });
      }
    }
    if (event.type === 'custom-span') {
      const span = event.payload as CustomSpanPayload;
      if (overlaps(span.startTime, span.duration)) {
        contributors.push({
          label: span.name,
          duration: span.duration,
          detail: span.status,
        });
      }
    }
  }
  return contributors.sort((left, right) => right.duration - left.duration);
}

function isInteractionEvent(
  event: AnyTraceLensEvent,
): event is AnyTraceLensEvent & { payload: InteractionPayload } {
  return event.type === 'interaction';
}

function row(label: string, duration: number): string {
  return `${label.padEnd(18)}${formatDuration(duration).padStart(9)}`;
}

function formatDuration(duration: number): string {
  return `${Math.round(duration)} ms`;
}

function ratingColor(duration: number): number {
  return duration <= 200 ? 32 : duration <= 500 ? 33 : 31;
}

function compactUrl(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

function fileName(value?: string): string | undefined {
  return value?.split('/').at(-1);
}
