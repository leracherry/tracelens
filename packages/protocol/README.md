# @tracelens/protocol

Telemetry types and validation for TraceLens v0.2.0.

## Installation

See [registry availability and authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md) before installing. npm scope publication is not yet confirmed; the GitHub Packages mirror and source builds are alternatives. Keep all TraceLens packages on matching versions.

```bash
npm install @tracelens/protocol@0.2.0
```

## Usage

```tsx
import { isTraceLensEvent } from '@tracelens/protocol';
import type { AnyTraceLensEvent } from '@tracelens/protocol';

const events: AnyTraceLensEvent[] = input.filter(isTraceLensEvent);
```

Defines versioned event envelopes and payloads shared by TraceLens packages. The example assumes input is an array of unknown values. Validation is not sanitization; apply privacy controls before storing or forwarding telemetry.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/privacy.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v0.2.0.md). Licensed MIT.
