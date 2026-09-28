export interface InteractionCandidate {
  id: string;
  type: 'click' | 'keydown' | 'pointerdown';
  name: string;
  startTime: number;
}

const ACTIVE_WINDOW = 5_000;

export class InteractionCorrelator {
  private readonly candidates: InteractionCandidate[] = [];

  add(candidate: InteractionCandidate): void {
    this.candidates.push(candidate);
    this.prune(candidate.startTime);
  }

  active(at: number): InteractionCandidate | undefined {
    this.prune(at);
    return this.findLast(
      (candidate) =>
        at >= candidate.startTime && at - candidate.startTime <= ACTIVE_WINDOW,
    );
  }

  match(type: string, at: number): InteractionCandidate | undefined {
    this.prune(at);
    return this.findLast(
      (candidate) =>
        candidate.type === type && Math.abs(candidate.startTime - at) <= 500,
    );
  }

  overlapping(
    startTime: number,
    duration: number,
  ): InteractionCandidate | undefined {
    const endTime = startTime + duration;
    this.prune(endTime);
    return this.findLast(
      (candidate) =>
        candidate.startTime <= endTime &&
        candidate.startTime + ACTIVE_WINDOW >= startTime,
    );
  }

  private prune(now: number): void {
    while (
      this.candidates[0] &&
      now - this.candidates[0].startTime > ACTIVE_WINDOW
    ) {
      this.candidates.shift();
    }
  }

  private findLast(
    predicate: (candidate: InteractionCandidate) => boolean,
  ): InteractionCandidate | undefined {
    for (let index = this.candidates.length - 1; index >= 0; index -= 1) {
      const candidate = this.candidates[index];
      if (candidate && predicate(candidate)) return candidate;
    }
    return undefined;
  }
}

export function sanitizeNetworkUrl(
  value: string,
  base = globalThis.location?.href,
): string {
  try {
    const url = new URL(value, base);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[redacted]';
  }
}
