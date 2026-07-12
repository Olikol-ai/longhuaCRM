import { resetUiIssues } from './issue-tracker';

export default async function globalSetup(): Promise<void> {
  resetUiIssues();
}
