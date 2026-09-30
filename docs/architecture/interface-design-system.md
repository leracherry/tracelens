# Interface design system

TraceLens uses a restrained, operational interface inspired by OpenAI's published UI guidance. The system is adapted to performance debugging rather than copied from an OpenAI product.

## Principles

- **Quiet by default.** Neutral surfaces and thin dividers keep the telemetry—not the chrome—at the center of attention.
- **Compact and legible.** System fonts, a small spacing scale, and a maximum 8 px corner radius make dense traces easier to scan.
- **Color carries meaning.** TraceLens blue identifies links and selected telemetry; green means healthy; amber means attention; red is reserved for errors.
- **One layer of containment.** Tables and timelines sit directly inside a panel instead of accumulating nested cards.
- **Accessible controls.** Every interactive surface has a visible focus state, sufficient contrast, and a mobile target of at least 44 px where space permits.

## Core tokens

| Role             | Light     | Dark      |
| ---------------- | --------- | --------- |
| Canvas           | `#ffffff` | `#171717` |
| Sidebar          | `#f7f7f8` | `#202020` |
| Primary text     | `#0d0d0d` | `#f2f2f2` |
| Divider          | `#e3e3e3` | `#383838` |
| TraceLens accent | `#0867d1` | `#69a8f5` |
| Success          | `#18794e` | `#5fd29d` |
| Attention        | `#a25700` | `#f4b45f` |

The product uses platform system fonts and a platform monospace stack for timing data. It intentionally avoids decorative gradients, glow effects, and imported font dependencies.

## Product application

Studio uses a compact workbench: persistent workspace navigation, a trace list, and a detail inspector. Playground uses the same shell and tokens so experiments feel like part of one product. Documentation keeps more whitespace while reusing the same typography, neutral surfaces, blue links, and logo treatment.

## References

- [OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)
- [OpenAI frontend guidance](https://developers.openai.com/api/docs/guides/frontend-prompt)
