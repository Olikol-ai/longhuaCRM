import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const issuesPath = join(process.cwd(), 'e2e', 'browser', 'ui-issues.json');
const auditPath = join(process.cwd(), 'docs', 'system-audit-report.md');

if (!existsSync(issuesPath)) {
  console.log('No ui-issues.json found — skip audit merge');
  process.exit(0);
}

const issues = JSON.parse(readFileSync(issuesPath, 'utf8'));
let audit = readFileSync(auditPath, 'utf8');

const sectionTitle = '## 11. Playwright UI/UX Issues (Browser E2E)';
const tableRows = issues
  .map(
    (row) =>
      `| ${row.flow} | ${row.step} | ${row.severity} | ${row.issue.replace(/\|/g, '\\|')} | Open |`,
  )
  .join('\n');

const block = `${sectionTitle}

| Flow | Step | Severity | Issue | Status |
|------|------|----------|-------|--------|
${tableRows || '| — | — | — | No issues recorded | — |'}

*Generated from Playwright browser tests (\`npm run test:browser\`).*
`;

if (audit.includes(sectionTitle)) {
  audit = audit.replace(
    /## 11\. Playwright UI\/UX Issues \(Browser E2E\)[\s\S]*?(?=\n## |\n\*Report updated|$)/,
    `${block}\n`,
  );
} else {
  audit = audit.replace(/(\*Report updated[^\n]*\n)$/, `\n${block}\n$1`);
}

writeFileSync(auditPath, audit, 'utf8');
console.log(`Merged ${issues.length} UI issue(s) into ${auditPath}`);
