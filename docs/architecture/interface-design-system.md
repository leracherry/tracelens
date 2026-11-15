# tracelens interface design system

tracelens adapts New Relic’s public 2026 UI refresh to the Studio and Playground workflows. The reference shows shared charcoal chrome in dark mode, blue navigation and actions, dense tables, and brighter categorical chart colors. tracelens keeps a bright light theme as the default and switches between Light and Dark with the appearance icon in Studio. [New Relic’s 2026 UI refresh](https://newrelic.com/blog/news/a-refreshed-modern-experience-introducing-new-relic-ui-updates)

## What came from the reference

- The public dark catalog screenshot shows `#131A1C` in the main canvas, `#1F2527` in the header and sidebar, `#25354A` behind selected navigation, and approximately `#3B72D9` on a primary action. Those are image samples. tracelens uses the charcoal surfaces in dark mode and shades its blue controls around the logo’s `#0785FA`. [New Relic catalog screenshot](https://newrelic.com/sites/default/files/styles/900w/public/2026-02/catalog.png?itok=j0dC7gg7)
- The dashboard screenshot shows categorical colors alongside threshold colors. In tracelens, each waterfall lane has a stable color, and named status chips carry health or severity. The SDK example’s `#A35EBF` is the light Browser lane marker, its `#85C956` example informed the React lane, and `#6ADFC6` sampled from the dashboard is the dark Layout lane marker. [New Relic dashboard screenshot](https://newrelic.com/sites/default/files/styles/900w/public/2026-02/dashboards.png?itok=9yzylnQK) · [LineChart SDK example](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/charts/linechart/) · [New Relic notebook color guidance](https://docs.newrelic.com/docs/query-your-data/explore-query-data/notebooks/visualizations-in-notebooks/)
- The public SDK documents component APIs and visual patterns. tracelens implements those patterns with keyboard-accessible dropdowns and local CSS. The values below describe tracelens’s implementation. A complete official platform token library was unavailable in the public references reviewed. [New Relic SDK component library](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/intro-to-sdk/)

## Palette

Shared tokens live in `apps/ui/tokens.css`. Studio and Playground import those tokens. VitePress maps the same roles to its documentation theme. The site defaults to dark and remembers the reader’s choice.

| Token                   | Light     | Dark      |
| ----------------------- | --------- | --------- |
| `--bg`                  | `#F3F6F7` | `#131A1C` |
| `--sidebar`             | `#F6F8F9` | `#1F2527` |
| `--masthead`            | `#FFFFFF` | `#1F2527` |
| `--nav-text`            | `#3D4B53` | `#C9D4D8` |
| `--nav-hover`           | `#E9EFF2` | `#283437` |
| `--nav-selected`        | `#E3F1FF` | `#203750` |
| `--nav-marker`          | `#005CAE` | `#B8DDFF` |
| `--nav-selected-border` | `#C1DFFF` | `#365B7E` |
| `--nav-line`            | `#D6DFE2` | `#354247` |
| `--surface`             | `#FFFFFF` | `#182023` |
| `--surface-subtle`      | `#F5F8FA` | `#222A2D` |
| `--surface-hover`       | `#EAF0F3` | `#283437` |
| `--surface-selected`    | `#E7F3FF` | `#203750` |
| `--text`                | `#1D252C` | `#EEF4F5` |
| `--muted`               | `#46565F` | `#B8C7CB` |
| `--faint`               | `#53636C` | `#ACBBBF` |
| `--border`              | `#D6DFE2` | `#354247` |
| `--border-strong`       | `#7B8C93` | `#81969E` |
| `--accent`              | `#0065BC` | `#78BDFF` |
| `--focus`               | `#0785FA` | `#9CCEFF` |
| `--accent-soft`         | `#E9F4FF` | `#203750` |
| `--success`             | `#196B51` | `#79E5B8` |
| `--success-soft`        | `#E5F7EF` | `#203B31` |
| `--warning`             | `#885A14` | `#FFDA8E` |
| `--warning-soft`        | `#FFF2D8` | `#40351F` |
| `--danger`              | `#A73533` | `#FFA6A0` |
| `--danger-soft`         | `#FFF0EF` | `#482C2D` |
| `--primary-bg`          | `#0069C6` | `#6BB7FF` |
| `--primary-hover`       | `#0059AC` | `#99CDFF` |
| `--primary-text`        | `#FFFFFF` | `#102840` |
| `--lane-browser-mark`   | `#9853B7` | `#D4A4EB` |
| `--lane-browser-fill`   | `#F3E8FA` | `#3D2C49` |
| `--lane-react-mark`     | `#527B2D` | `#ADE076` |
| `--lane-react-fill`     | `#EDF6E2` | `#2A3D28` |
| `--lane-network-mark`   | `#096FC8` | `#72BDFF` |
| `--lane-network-fill`   | `#E4F2FF` | `#1D3950` |
| `--lane-custom-mark`    | `#A05820` | `#FFC493` |
| `--lane-custom-fill`    | `#FFF0E1` | `#46331F` |
| `--lane-layout-mark`    | `#087763` | `#71DFCA` |
| `--lane-layout-fill`    | `#E2F7F3` | `#1E3D39` |

## Typography, layout, and controls

| Element                      | tracelens implementation                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page titles                  | Inter when installed, then the system sans-serif at 24 px / 32 px and weight 650                                                                                                                                                                |
| Standard UI                  | 13 px text, 12 px controls and table metadata, and 14–15 px section headings                                                                                                                                                                    |
| Timing and identifiers       | Tabular figures and the local monospace stack for timing values, routes, and source locations                                                                                                                                                   |
| Global header and navigation | One continuous header surface across the brand and toolbar. Desktop sidebar is 208 px wide, reduced to 168 px on tablet. Mobile navigation sits above the workspace.                                                                            |
| Workspace and panels         | 24 px desktop and 16 px mobile side gutters. Panels use 16 px internal spacing, a one-pixel border, and a 6 px radius.                                                                                                                          |
| Selects and buttons          | 36 px desktop and 44 px mobile targets, 4 px corners, keyboard-accessible dropdowns, a 14 px chevron inset, and 36 px reserved trailing space                                                                                                   |
| Comparison alignment         | Equal baseline and candidate field widths, a centered arrow, and right-aligned numeric columns. Commit and sample counts sit beneath their build.                                                                                               |
| Icons                        | 16 px pulse and tag icons for navigation, 18 px sun, moon, and monitor icons for appearance, and 14 px directional arrows. The icon inherits the label’s color and is hidden from assistive technology when the label already names the action. |
| Charts and tables            | Separate metric cards, compact rows, labeled deltas, and a selectable waterfall with timing and source details. Responsive deltas become cards with visible column labels.                                                                      |

The public SDK describes semantic heading levels, spacing, controls, and tables. New Relic’s trace details guide describes selecting waterfall events for context. tracelens applies those patterns to browser interactions and release comparisons. [HeadingText](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/text/headingtext/) · [Spacing](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/structure/spacing/) · [Select](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/controls/select/) · [Table](https://docs.newrelic.com/docs/new-relic-solutions/build-nr-ui/sdk-component/tables/table/) · [Trace details](https://docs.newrelic.com/docs/distributed-tracing/ui-data/trace-details/)

Use blue for actions, links, and selection, green for positive states, amber for regressions or warnings, and red for errors. Pair status with text. Keep the tracelens mark as the product identity.

See the [Studio UX validation guide](../guides/studio-ux-validation.md) for browser checks and screenshot verification.
