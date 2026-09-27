import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { Reporter, TestCase } from '@playwright/test/reporter';

/**
 * Lists the tests that failed and then passed on a retry. In CI it writes them to the job
 * summary, so a retry that keeps main green still leaves the flaky spec in plain sight.
 */
export default class FlakyReporter implements Reporter {
  readonly #tests = new Set<TestCase>();

  onTestEnd(test: TestCase): void {
    this.#tests.add(test);
  }

  onEnd(): void {
    const flaky = [...this.#tests].filter((test) => test.outcome() === 'flaky');
    const lines = flaky.map((test) => {
      const [, project, , ...titles] = test.titlePath();
      const file = relative(process.cwd(), test.location.file);
      return `- \`${file}:${test.location.line}\` [${project}] ${titles.join(' › ')}`;
    });
    const summary = [
      '## E2E specs that passed only on retry',
      '',
      ...(lines.length > 0 ? lines : ['None: every spec passed on its first try.']),
      '',
    ].join('\n');
    const target = process.env['GITHUB_STEP_SUMMARY'];
    if (target) appendFileSync(target, summary);
    else if (flaky.length > 0) console.log(summary);
  }
}
