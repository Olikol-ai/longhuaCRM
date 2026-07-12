import { flushUiIssuesReport } from './issue-tracker';

export default async function globalTeardown(): Promise<void> {
  flushUiIssuesReport();
}
