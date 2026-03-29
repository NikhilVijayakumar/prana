import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface ScreenInventory {
  screens: string[];
}

interface IssueRecord {
  severity: Severity;
  title: string;
  source: 'auto-failure' | 'annotation';
}

interface TestRecord {
  testId: string;
  title: string;
  file: string;
  status: TestResult['status'];
  expectedStatus: TestCase['expectedStatus'];
  durationMs: number;
  screens: string[];
  issues: IssueRecord[];
  errors: string[];
  attachments: Array<{
    name: string;
    contentType: string;
    path?: string;
  }>;
}

class QualityReporter implements Reporter {
  private config: FullConfig | null = null;
  private suite: Suite | null = null;
  private startedAtIso: string = new Date().toISOString();
  private tests: TestRecord[] = [];

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
    this.startedAtIso = new Date().toISOString();
    this.tests = [];
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const severity = this.readSeverityAnnotation(test);
    const screens = this.readScreens(test);
    const issueAnnotations = this.readIssueAnnotations(test);
    const autoFailureIssue = this.buildAutoFailureIssue(test, result, severity);
    const errors = (result.errors ?? []).map((entry) => entry.message).filter((entry): entry is string => !!entry);

    const record: TestRecord = {
      testId: test.id,
      title: test
        .titlePath()
        .filter((segment) => segment.trim().length > 0)
        .join(' > '),
      file: this.toWorkspaceRelative(test.location.file),
      status: result.status,
      expectedStatus: test.expectedStatus,
      durationMs: result.duration,
      screens,
      issues: [...issueAnnotations, ...(autoFailureIssue ? [autoFailureIssue] : [])],
      errors,
      attachments: (result.attachments ?? []).map((attachment) => ({
        name: attachment.name,
        contentType: attachment.contentType,
        path: attachment.path ? this.toWorkspaceRelative(attachment.path) : undefined,
      })),
    };

    this.tests.push(record);
  }

  onEnd(result: FullResult): void {
    const outputDir = this.resolveOutputDir();
    mkdirSync(outputDir, { recursive: true });

    const inventory = this.readScreenInventory();
    const coveredScreens = [...new Set(this.tests.flatMap((entry) => entry.screens))].sort();
    const missingScreens = inventory ? inventory.screens.filter((screen) => !coveredScreens.includes(screen)) : [];

    const summary = {
      startedAt: this.startedAtIso,
      finishedAt: new Date().toISOString(),
      durationMs: result.duration,
      status: result.status,
      totalTests: this.tests.length,
      passed: this.tests.filter((entry) => entry.status === 'passed').length,
      failed: this.tests.filter((entry) => entry.status === 'failed' || entry.status === 'timedOut').length,
      flaky: this.tests.filter((entry) => entry.status === 'flaky').length,
      skipped: this.tests.filter((entry) => entry.status === 'skipped' || entry.status === 'interrupted').length,
      uniqueTestFiles: [...new Set(this.tests.map((entry) => entry.file))].sort(),
      inventoryScreens: inventory?.screens ?? null,
      coveredScreens,
      missingScreens,
      tests: this.tests,
    };

    const jsonPath = resolve(outputDir, 'e2e-quality-report.json');
    const markdownPath = resolve(outputDir, 'e2e-quality-report.md');

    writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
    writeFileSync(markdownPath, this.toMarkdown(summary), 'utf8');

    if (missingScreens.length > 0) {
      console.error('\n======================================================');
      console.error('❌ E2E QUALITY GATE FAILED: ORPHAN SCREENS DETECTED');
      console.error('======================================================');
      console.error(`The following screens are in the inventory but were not covered:`);
      missingScreens.forEach((s) => console.error(`  - ${s}`));
      console.error('Ensure these screens are covered across your test scenarios.');
      console.error('======================================================\n');
    }
  }

  private resolveOutputDir(): string {
    return resolve(process.cwd(), 'test-results', 'playwright');
  }

  private toWorkspaceRelative(inputPath?: string): string {
    if (!inputPath) {
      return 'unknown';
    }

    const workspaceRoot = process.cwd();
    const relativePath = relative(workspaceRoot, inputPath);
    return relativePath.split('\\').join('/');
  }

  private readSeverityAnnotation(test: TestCase): Severity {
    const severity = test.annotations.find((annotation) => annotation.type === 'severity')?.description?.toLowerCase();
    if (severity === 'critical' || severity === 'high' || severity === 'medium' || severity === 'low') {
      return severity;
    }

    return 'high';
  }

  private readScreens(test: TestCase): string[] {
    return test.annotations
      .filter((annotation) => annotation.type === 'screen' && annotation.description)
      .map((annotation) => annotation.description as string)
      .sort();
  }

  private readIssueAnnotations(test: TestCase): IssueRecord[] {
    return test.annotations
      .filter((annotation) => annotation.type === 'issue' && annotation.description)
      .map((annotation) => ({
        severity: this.readSeverityAnnotation(test),
        title: annotation.description as string,
        source: 'annotation' as const,
      }));
  }

  private buildAutoFailureIssue(
    test: TestCase,
    result: TestResult,
    severity: Severity,
  ): IssueRecord | null {
    if (result.status === 'passed' || result.status === 'skipped') {
      return null;
    }

    const firstError = result.errors?.find((entry) => !!entry.message)?.message;
    return {
      severity,
      title: firstError ? `${test.title}: ${firstError}` : `${test.title}: execution failed`,
      source: 'auto-failure',
    };
  }

  private readScreenInventory(): ScreenInventory | null {
    const inventoryPath = resolve(process.cwd(), 'tests', 'e2e', 'screen-inventory.json');
    if (!existsSync(inventoryPath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(readFileSync(inventoryPath, 'utf8')) as ScreenInventory;
      if (!parsed || !Array.isArray(parsed.screens)) {
        return null;
      }

      return {
        screens: parsed.screens.map((screen) => String(screen)).sort(),
      };
    } catch {
      return null;
    }
  }

  private toMarkdown(summary: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    status: string;
    totalTests: number;
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
    uniqueTestFiles: string[];
    inventoryScreens: string[] | null;
    coveredScreens: string[];
    missingScreens: string[];
    tests: TestRecord[];
  }): string {
    const issueRows = summary.tests.flatMap((test) =>
      test.issues.map((issue) => ({
        severity: issue.severity,
        source: issue.source,
        test: test.title,
        issue: issue.title,
      })),
    );

    const lines: string[] = [];
    lines.push('# E2E QA Report');
    lines.push('');
    lines.push('## Run Summary');
    lines.push(`- Status: ${summary.status}`);
    lines.push(`- Started: ${summary.startedAt}`);
    lines.push(`- Finished: ${summary.finishedAt}`);
    lines.push(`- Duration (ms): ${summary.durationMs}`);
    lines.push(`- Total tests: ${summary.totalTests}`);
    lines.push(`- Passed: ${summary.passed}`);
    lines.push(`- Failed: ${summary.failed}`);
    lines.push(`- Flaky: ${summary.flaky}`);
    lines.push(`- Skipped: ${summary.skipped}`);
    lines.push('');

    lines.push('## Test File Coverage');
    if (summary.uniqueTestFiles.length === 0) {
      lines.push('- No test files were executed.');
    } else {
      for (const file of summary.uniqueTestFiles) {
        lines.push(`- ${file}`);
      }
    }
    lines.push('');

    lines.push('## Screen Coverage');
    if (!summary.inventoryScreens) {
      lines.push('- Screen inventory file not found at tests/e2e/screen-inventory.json.');
      lines.push(`- Covered screens (from annotations): ${summary.coveredScreens.length}`);
    } else {
      lines.push(`- Inventory screens: ${summary.inventoryScreens.length}`);
      lines.push(`- Covered screens: ${summary.coveredScreens.length}`);
      lines.push(`- Missing screens: ${summary.missingScreens.length}`);
    }

    if (summary.coveredScreens.length > 0) {
      lines.push('- Covered list:');
      for (const screen of summary.coveredScreens) {
        lines.push(`  - ${screen}`);
      }
    }

    if (summary.missingScreens.length > 0) {
      lines.push('- Missing list:');
      for (const screen of summary.missingScreens) {
        lines.push(`  - ${screen}`);
      }
    }
    lines.push('');

    lines.push('## Issues');
    if (issueRows.length === 0) {
      lines.push('- No issues detected in this run.');
    } else {
      lines.push('| Severity | Source | Test | Issue |');
      lines.push('| --- | --- | --- | --- |');
      for (const row of issueRows) {
        lines.push(`| ${row.severity} | ${row.source} | ${row.test.replace(/\|/g, '\\|')} | ${row.issue.replace(/\|/g, '\\|')} |`);
      }
    }
    lines.push('');

    lines.push('## Detailed Results');
    for (const test of summary.tests) {
      lines.push(`### ${test.title}`);
      lines.push(`- Status: ${test.status}`);
      lines.push(`- File: ${test.file}`);
      lines.push(`- Duration (ms): ${test.durationMs}`);
      lines.push(`- Screens: ${test.screens.length ? test.screens.join(', ') : 'not annotated'}`);

      if (test.errors.length) {
        lines.push('- Errors:');
        for (const error of test.errors) {
          lines.push(`  - ${error}`);
        }
      }

      if (test.attachments.length) {
        lines.push('- Evidence:');
        for (const attachment of test.attachments) {
          const pathValue = attachment.path ?? 'inline';
          lines.push(`  - ${attachment.name} (${attachment.contentType}) -> ${pathValue}`);
        }
      }

      lines.push('');
    }

    lines.push('## How To Review');
    lines.push('- Open HTML report: npm run test:e2e:show-report');
    lines.push('- Open quality markdown: test-results/playwright/e2e-quality-report.md');
    lines.push('- Open quality json: test-results/playwright/e2e-quality-report.json');

    return `${lines.join('\n')}\n`;
  }
}

export default QualityReporter;
