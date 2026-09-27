# Performance debugging walkthrough

The TraceLens Playground contains controlled performance failures. Use it to verify instrumentation or practice reading an interaction trace without modifying a production application.

## Start the workspace

```bash
pnpm install
pnpm dev
```

Open the playground at <http://localhost:4174> and Studio at <http://localhost:4173>.

## Run a scenario

Choose one scenario from the left navigation and select a load intensity. Run it once, then switch to Studio and select the newest interaction.

| Scenario          | Simulated problem                        | Signals to inspect                            |
| ----------------- | ---------------------------------------- | --------------------------------------------- |
| Slow search       | Large synchronous filter                 | Processing time, custom span, long frame      |
| Settings save     | Serialization and delayed PATCH          | INP subparts, network lane, blocking duration |
| Slow checkout     | Delayed POST and render fan-out          | Network duration, follow-up frame             |
| Layout thrash     | Repeated geometry reads and style writes | Long frame and layout lane                    |
| Third-party block | Synchronous analytics initialization     | Script/custom-span attribution                |

## Read the trace

Start with the three INP subparts:

- High **input delay** means earlier main-thread work prevented the handler from starting.
- High **processing** means the interaction handler itself performed expensive work.
- High **presentation** means rendering and painting delayed the next frame.

Next, inspect the primary contributor and correlated timeline. Network work can extend beyond the INP interval while still sharing the initiating interaction ID. Long frames report blocking duration separately from total frame duration.

## Compare intensity levels

Repeat a scenario at `0.7×`, `1×`, and `1.4×`. The result should preserve the same attribution shape while durations increase. Exact values vary with browser and hardware.
