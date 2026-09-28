# Interaction correlation

TraceLens associates browser work with the input that initiated it without retaining DOM text or application payloads.

## Lifecycle

1. A capture-phase listener records a short-lived candidate for `click`, `pointerdown`, or `keydown`.
2. The candidate receives a random correlation ID and a privacy-safe element name.
3. Event Timing entries are matched to candidates by event type and start time.
4. Work started during the five-second candidate window inherits the same ID:
   - fetch and XMLHttpRequest spans
   - Long Animation Frame entries
   - layout-shift entries
5. Studio prefers exact correlation IDs and uses timing overlap as a fallback for older traces.

## Privacy boundary

Network telemetry contains the method, sanitized URL, status, timing, and transport. Query strings, fragments, request bodies, response bodies, and application headers are excluded.

Element descriptors use `data-tracelens-name`, role, and input type by default. `aria-label` and `id` require explicit privacy allowlist entries in v0.2.1. DOM text and input values are not inspected. See [privacy controls](../guides/privacy.md).

## Limitations

Event Timing and Long Animation Frame availability varies by browser. Async work that begins more than five seconds after an input is not automatically attributed. Applications can use `trace()` for explicit spans when browser timing alone is insufficient.
