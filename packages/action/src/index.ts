import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { DefaultArtifactClient } from '@actions/artifact';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  evaluateBudgets,
  loadBudgetConfig,
  type BudgetReport,
} from '../../cli/src/budget.js';
import { readTraceFile } from '../../cli/src/trace-file.js';
import {
  COMMENT_MARKER,
  renderMarkdownReport,
  renderPullRequestComment,
  reportSummary,
} from './report.js';

type Octokit = ReturnType<typeof github.getOctokit>;
type CommentMode = 'auto' | 'always' | 'never';

async function run(): Promise<void> {
  try {
    const workspace = resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
    const reportPath = workspaceOutputPath(
      workspace,
      core.getInput('report-file') || 'tracelens-budget-report.json',
    );
    const configPath = inputPath(
      workspace,
      core.getInput('config-file') || 'tracelens.yml',
    );
    const tracePath = inputPath(
      workspace,
      core.getInput('trace-file', {
        required: true,
      }),
    );
    const [config, events] = await Promise.all([
      loadBudgetConfig(configPath),
      readTraceFile(tracePath),
    ]);
    const report = evaluateBudgets(events, config, {
      release: optionalInput('release'),
      app: optionalInput('app'),
      environment: optionalInput('environment'),
    });
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });

    const markdown = renderMarkdownReport(report);
    const summary = reportSummary(report);
    const failOnBudget = core.getBooleanInput('fail-on-budget');
    core.setOutput('passed', String(report.passed));
    core.setOutput('report-file', reportPath);
    core.setOutput('summary', summary);
    await core.summary.addRaw(markdown).write();
    core.info(summary);

    if (core.getBooleanInput('upload-artifact')) {
      await uploadReport(reportPath, workspace);
    }
    const token = optionalInput('github-token');
    if (token) {
      const octokit = github.getOctokit(token);
      if (core.getBooleanInput('create-check')) {
        await bestEffort('create the GitHub check', () =>
          createCheck(octokit, report, markdown, failOnBudget),
        );
      }
      await bestEffort('update the pull-request comment', () =>
        updatePullRequestComment(octokit, report, commentMode()),
      );
    } else {
      core.info(
        'No github-token was provided; skipping the check run and pull-request comment.',
      );
    }

    if (!report.passed && failOnBudget) {
      core.setFailed('TraceLens performance budget failed.');
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

async function uploadReport(path: string, workspace: string): Promise<void> {
  const client = new DefaultArtifactClient();
  const response = await client.uploadArtifact(
    core.getInput('artifact-name') || 'tracelens-performance-report',
    [path],
    workspace,
    { retentionDays: 14 },
  );
  core.info(
    `Uploaded report artifact${response.id ? ` (ID ${response.id})` : ''}.`,
  );
}

async function createCheck(
  octokit: Octokit,
  report: BudgetReport,
  markdown: string,
  failOnBudget: boolean,
): Promise<void> {
  const { owner, repo } = github.context.repo;
  if (!github.context.sha) throw new Error('GITHUB_SHA is unavailable');
  await octokit.rest.checks.create({
    owner,
    repo,
    name: 'TraceLens Performance Budget',
    head_sha: github.context.sha,
    status: 'completed',
    conclusion: report.passed
      ? 'success'
      : failOnBudget
        ? 'failure'
        : 'neutral',
    output: {
      title: reportSummary(report),
      summary: markdown,
    },
  });
}

async function updatePullRequestComment(
  octokit: Octokit,
  report: BudgetReport,
  mode: CommentMode,
): Promise<void> {
  if (mode === 'never') return;
  const issueNumber = github.context.payload.pull_request?.number;
  if (!issueNumber) {
    if (mode === 'always')
      core.warning(
        'No pull request was found; skipping the requested comment.',
      );
    return;
  }
  const { owner, repo } = github.context.repo;
  const body = renderPullRequestComment(report);
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });
  const existing = comments.find(
    (comment) =>
      comment.user?.type === 'Bot' && comment.body?.includes(COMMENT_MARKER),
  );
  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
  }
}

async function bestEffort(
  label: string,
  operation: () => Promise<void>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    core.warning(
      `Could not ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function commentMode(): CommentMode {
  const value = (core.getInput('comment') || 'auto').toLowerCase();
  if (value === 'auto' || value === 'always' || value === 'never') return value;
  throw new Error('comment must be auto, always, or never');
}

function optionalInput(name: string): string | undefined {
  return core.getInput(name).trim() || undefined;
}

function inputPath(workspace: string, value: string): string {
  return isAbsolute(value) ? value : resolve(workspace, value);
}

function workspaceOutputPath(workspace: string, value: string): string {
  const output = inputPath(workspace, value);
  const path = relative(workspace, output);
  if (path.startsWith('..') || isAbsolute(path)) {
    throw new Error('report-file must resolve inside GITHUB_WORKSPACE');
  }
  return output;
}

void run();
