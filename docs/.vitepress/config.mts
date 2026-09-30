import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'TraceLens',
  description:
    'Real-user performance debugging for browser interactions, React renders, and release regressions.',
  lang: 'en-US',
  base: '/tracelens/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/tracelens/logo.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/tracelens/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1683f4' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'TraceLens Documentation' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Find the interaction, frame, component, and release behind frontend regressions.',
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'TraceLens',
    nav: [
      { text: 'Guide', link: '/guides/getting-started' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'GitHub Action', link: '/guides/github-action' },
      { text: 'v0.4.0', link: '/releases/v0.4.0' },
    ],
    sidebar: {
      '/guides/': [
        {
          text: 'Start',
          items: [
            { text: 'Getting started', link: '/guides/getting-started' },
            {
              text: 'Browser instrumentation',
              link: '/guides/browser-instrumentation',
            },
            {
              text: 'Browser support and overhead',
              link: '/guides/browser-testing-overhead',
            },
            { text: 'React attribution', link: '/guides/react-attribution' },
            {
              text: 'Debug an interaction',
              link: '/guides/performance-debugging-walkthrough',
            },
            {
              text: 'Studio UX validation',
              link: '/guides/studio-ux-validation',
            },
          ],
        },
        {
          text: 'Production workflow',
          items: [
            { text: 'Compare releases', link: '/guides/releases' },
            {
              text: 'Performance budgets',
              link: '/guides/performance-budgets',
            },
            { text: 'GitHub Action', link: '/guides/github-action' },
            { text: 'Privacy controls', link: '/guides/privacy' },
            { text: 'Reliability and lifecycle', link: '/guides/reliability' },
            { text: 'Source maps', link: '/guides/source-maps' },
            { text: 'OpenTelemetry', link: '/guides/opentelemetry' },
          ],
        },
        {
          text: 'Project',
          items: [{ text: 'Publishing', link: '/guides/publishing' }],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'System overview', link: '/architecture/overview' },
            {
              text: 'Interaction correlation',
              link: '/architecture/interaction-correlation',
            },
          ],
        },
      ],
      '/releases/': [
        {
          text: 'Releases',
          items: [
            { text: 'v0.4.0', link: '/releases/v0.4.0' },
            { text: 'v0.3.0', link: '/releases/v0.3.0' },
            { text: 'v0.2.1', link: '/releases/v0.2.1' },
            { text: 'v0.2.0', link: '/releases/v0.2.0' },
            { text: 'v0.1.0', link: '/releases/v0.1.0' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    outline: { level: [2, 3], label: 'On this page' },
    editLink: {
      pattern: 'https://github.com/leracherry/tracelens/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/leracherry/tracelens' },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/@leracherry/tracelens-browser',
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'TraceLens — understand the interaction, not just the score.',
    },
  },
});
