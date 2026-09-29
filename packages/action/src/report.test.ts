import { describe, expect, it } from 'vitest';
import type { BudgetReport } from '../../cli/src/budget.js';
import {
  COMMENT_MARKER,
  renderMarkdownReport,
  renderPullRequestComment,
  reportSummary,
} from './report.js';

const report: BudgetReport = {
  schemaVersion: 1,
  passed: false,
  release: '2.14.0',
  app: 'billing|dashboard',
  environment: 'production',
  checks: [
    {
      scope: 'overall',
      metric: 'lcp.p75',
      actual: 2130,
      threshold: 2500,
      samples: 84,
      status: 'pass',
    },
    {
      scope: 'route',
      route: '/checkout|pay',
      metric: 'inp.p75',
      actual: 238,
      threshold: 150,
      samples: 42,
      status: 'fail',
    },
    {
      scope: 'overall',
      metric: 'cls.p75',
      threshold: 0.1,
      samples: 0,
      status: 'no-data',
    },
  ],
};

describe('GitHub Action reports', () => {
  it('renders a deterministic GitHub summary table', () => {
    expect(renderMarkdownReport(report)).toContain(
      '| ❌ Fail | /checkout\\\|pay | inp\\.p75 | 238 ms | 150 ms | 42 |',
    );
    expect(renderMarkdownReport(report)).toContain(
      '| ⚠️ No data | Overall | cls\\.p75 | — | 0.100 | 0 |',
    );
    expect(reportSummary(report)).toBe(
      'Failed: 1 passed, 1 failed, 1 without enough data',
    );
  });

  it('uses a stable marker so pull-request comments can be updated', () => {
    const comment = renderPullRequestComment(report);
    expect(comment.startsWith(`${COMMENT_MARKER}\n`)).toBe(true);
    expect(comment.match(/tracelens-performance-report/g)).toHaveLength(1);
  });
});
