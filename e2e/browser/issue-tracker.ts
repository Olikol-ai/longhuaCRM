import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type UiIssue = {
  flow: string;
  step: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  timestamp: string;
};

const issuesDir = join(process.cwd(), 'e2e', 'browser');
const issuesPath = join(issuesDir, 'ui-issues.json');

function ensureIssuesFile(): void {
  mkdirSync(issuesDir, { recursive: true });
  if (!existsSync(issuesPath)) {
    writeFileSync(issuesPath, '[]', 'utf8');
  }
}

export function recordUiIssue(
  flow: string,
  step: string,
  issue: string,
  severity: UiIssue['severity'] = 'high',
): void {
  const entry: UiIssue = {
    flow,
    step,
    issue,
    severity,
    timestamp: new Date().toISOString(),
  };

  ensureIssuesFile();
  const current = JSON.parse(readFileSync(issuesPath, 'utf8')) as UiIssue[];
  current.push(entry);
  writeFileSync(issuesPath, JSON.stringify(current, null, 2), 'utf8');
}

export function resetUiIssues(): void {
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(issuesPath, '[]', 'utf8');
}

export function flushUiIssuesReport(): void {
  ensureIssuesFile();
}
