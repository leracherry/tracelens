# GitHub Action

The TraceLens Action checks a JSON event export against `tracelens.yml`, publishes the same stable JSON report as a workflow artifact, adds a Markdown job summary, creates a GitHub Check, and creates or updates one pull-request comment.

The Action ships with the v1.0.0 repository release. Version tags are convenient for examples; pin a full commit SHA when your security policy requires an immutable action reference.

## Workflow

Your preceding steps must produce a JSON array of TraceLens events. Copy the [complete workflow](../../examples/github-action/performance-budget.yml), or add this step to an existing workflow:

```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write

steps:
  - uses: actions/checkout@v7

  - name: Check TraceLens performance budgets
    uses: leracherry/tracelens@v1.0.0
    with:
      trace-file: artifacts/tracelens-events.json
      config-file: tracelens.yml
      github-token: ${{ secrets.GITHUB_TOKEN }}
      app: billing-dashboard
      environment: production
```

The action fails when any threshold is exceeded or a check has fewer than `minimumSamples`. Set `fail-on-budget: false` to run in reporting-only mode while establishing a baseline; failed budget checks then use a neutral GitHub Check conclusion.

The default `comment: auto` posts only for pull-request events. TraceLens searches for its hidden marker and updates the existing bot comment on later runs instead of adding another comment. Use `comment: never` to disable this behavior, or `comment: always` to request a comment and receive a warning on non-PR events.

## Inputs

| Input             | Required | Default                        | Description                                                  |
| ----------------- | :------: | ------------------------------ | ------------------------------------------------------------ |
| `trace-file`      |   Yes    | —                              | TraceLens JSON event array.                                  |
| `config-file`     |    No    | `tracelens.yml`                | Performance-budget YAML.                                     |
| `release`         |    No    | Newest in trace                | Release selector.                                            |
| `app`             |    No    | Inferred                       | Application selector. Required for mixed-app traces.         |
| `environment`     |    No    | Inferred                       | Environment selector. Required for mixed-environment traces. |
| `github-token`    |    No    | —                              | Token for check runs and PR comments.                        |
| `create-check`    |    No    | `true`                         | Create a completed GitHub Check when a token exists.         |
| `comment`         |    No    | `auto`                         | `auto`, `always`, or `never`.                                |
| `upload-artifact` |    No    | `true`                         | Upload the JSON report for 14 days.                          |
| `artifact-name`   |    No    | `tracelens-performance-report` | Artifact name.                                               |
| `report-file`     |    No    | `tracelens-budget-report.json` | Workspace-relative JSON output path.                         |
| `fail-on-budget`  |    No    | `true`                         | Fail the action for failed or no-data checks.                |

## Outputs

- `passed`: `true` only when every configured check passes.
- `report-file`: absolute path to the generated JSON report.
- `summary`: concise pass/fail/no-data counts.

The JSON report is written before GitHub API calls and remains available to later steps with `if: always()`. The report path must stay within `GITHUB_WORKSPACE`; this prevents an accidental output setting from overwriting files elsewhere on the runner.

## Permissions and fork pull requests

`contents: read` is sufficient for the local budget evaluation, job summary, and workflow artifact. `checks: write` enables the dedicated check run, and `pull-requests: write` enables the PR comment. If no token is supplied, the action skips both GitHub API features but still evaluates budgets.

GitHub normally gives workflows from forked pull requests a read-only token. TraceLens treats check/comment permission errors as warnings so the budget result and artifact are still produced. Do not use `pull_request_target` to run untrusted contribution code with a write token.

## Reports

The job summary, check, PR comment, and JSON artifact all describe the same evaluation. The Markdown surfaces show metric, scope, actual value, threshold, and sample count. A missing sample is displayed as `No data` and fails closed.

See [performance budgets](performance-budgets.md) for configuration, metric semantics, and CLI usage.
