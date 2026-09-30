# @leracherry/tracelens-protocol

Telemetry types and validation for TraceLens v1.0.0.

## Installation

Install from npm using the command below, or see [GitHub Packages authentication](https://github.com/leracherry/tracelens/blob/main/docs/guides/publishing.md). Both registries use the same package names. Keep all TraceLens packages on matching versions.

```bash
npm install @leracherry/tracelens-protocol@1.0.0
```

## Usage

```tsx
import { isTraceLensEvent } from '@leracherry/tracelens-protocol';
import type { AnyTraceLensEvent } from '@leracherry/tracelens-protocol';

const events: AnyTraceLensEvent[] = input.filter(isTraceLensEvent);
```

Defines versioned event envelopes and payloads shared by TraceLens packages. The example assumes input is an array of unknown values. Validation is not sanitization; apply privacy controls before storing or forwarding telemetry.

See the [guide](https://github.com/leracherry/tracelens/blob/main/docs/guides/privacy.md) and [release notes](https://github.com/leracherry/tracelens/blob/main/docs/releases/v1.0.0.md). Licensed MIT.
