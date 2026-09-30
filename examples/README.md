# TraceLens examples

| Example                                               | Demonstrates                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| [Vanilla TypeScript](vanilla)                         | Browser initialization, interaction naming, marks, and custom spans        |
| [React + Vite](react-vite)                            | Vite release metadata, React profiling boundaries, and browser correlation |
| [Performance budget](budgets/tracelens.yml)           | Strict release and route thresholds                                        |
| [GitHub Action](github-action/performance-budget.yml) | Checks, artifacts, and pull-request reporting                              |
| [OpenTelemetry Collector](otel/collector.yaml)        | OTLP/HTTP receiver setup                                                   |
| [Synthetic trace](traces/slow-settings.json)          | Safe CLI, Action, and release-comparison input                             |

Application examples expect Studio at `http://127.0.0.1:4173`. Run `npx @leracherry/tracelens-cli@1.0.0 studio` before starting them.
