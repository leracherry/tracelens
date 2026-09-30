---
layout: home

hero:
  name: TraceLens
  text: Explain slow real-user interactions
  tagline: Correlate INP, long frames, React renders, network work, source maps, and release regressions in one local-first debugging workflow.
  image:
    src: /logo.png
    alt: TraceLens logo
  actions:
    - theme: brand
      text: Get started
      link: /guides/getting-started
    - theme: alt
      text: Debug an interaction
      link: /guides/performance-debugging-walkthrough
    - theme: alt
      text: View on GitHub
      link: https://github.com/leracherry/tracelens

features:
  - title: Interaction-first
    details: Break responsiveness into input delay, processing, and presentation—and connect the result to overlapping browser work.
  - title: React-aware
    details: Place profiler boundaries around product regions and see commit cost beside the interaction that caused it.
  - title: ReleaseScope
    details: Compare builds by interaction, route, and component to find where a regression entered the release stream.
  - title: Source-mapped
    details: Resolve long-frame script contributions to original source locations and open safe repository links.
  - title: Privacy-conscious
    details: Drop query strings, credentials, DOM text, values, bodies, and headers before telemetry leaves the page.
  - title: CI-enforced
    details: Turn release telemetry into budgets, GitHub Checks, job summaries, artifacts, and one continuously updated PR comment.
---

<div class="metric-strip">
  <div><strong>INP</strong><span>Interaction timing</span></div>
  <div><strong>LoAF</strong><span>Main-thread work</span></div>
  <div><strong>React</strong><span>Render attribution</span></div>
  <div><strong>OTLP</strong><span>Trace export</span></div>
</div>

## One interaction, fully explained

TraceLens is built for the question a score cannot answer: **what actually made this interaction slow?** Start at a user-visible delay, follow its correlated work, then compare the same signal across releases.

![TraceLens Studio interaction view showing a Save settings interaction correlated with browser, React, custom, network, layout, and source-mapped script work](./assets/studio-interaction.png)

```bash
npm install @leracherry/tracelens-browser
npx @leracherry/tracelens-cli@1.0.0 studio
```

[Instrument the browser →](./guides/browser-instrumentation.md)

::: details Watch the nine-second Studio tour
![Studio demo: interaction list, Save settings detail, then ReleaseScope](./assets/studio-demo.gif)

Captured from the real Studio UI using synthetic telemetry. Each view is held for three seconds. Collapse this section to hide the animation; the image above is a static alternative. [Reproduce the capture](https://github.com/leracherry/tracelens/blob/main/CONTRIBUTING.md#product-screenshots-and-demo).
:::

[Contribute](https://github.com/leracherry/tracelens/blob/main/CONTRIBUTING.md) · [Code of Conduct](https://github.com/leracherry/tracelens/blob/main/CODE_OF_CONDUCT.md) · [Report a vulnerability privately](https://github.com/leracherry/tracelens/security/advisories/new)

## Make regressions part of the workflow

Define release and route budgets in YAML, evaluate captured telemetry locally, then run the same engine in pull requests.

```yaml
- uses: leracherry/tracelens@v1.0.0
  with:
    trace-file: artifacts/tracelens-events.json
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

[Configure the GitHub Action →](./guides/github-action.md)
