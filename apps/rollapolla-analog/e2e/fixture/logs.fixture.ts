import { test as base, expect as expectBase } from '@playwright/test';

// Extend basic test by providing a "todoPage" fixture.
export const test = base.extend<{ logs: string[] }>({
  logs: async ({ page }, use) => {
    let logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await use(logs);
    logs = [];
  },
});

export const expect = expectBase.extend({
  async toHaveConsoleMsg(logs: string[], expected: string) {
    const assertionName = 'toHaveConsoleMsg';
    let pass: boolean;
    let log: string;
    let matcherResult: any;
    try {
      await expect(async () => {
        expect(logs).toContainEqual(expect.stringContaining(expected));
      }).toPass({ timeout: 240 * 60 * 1000 });
      pass = true;
      log = logs.find((log) => log.includes(expected));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      const matcherResult = e.matcherResult;
      pass = false;
    }
    const message = pass
      ? () =>
          this.utils.matcherHint(assertionName, undefined, undefined, {
            isNot: this.isNot,
          }) +
          '\n\n' +
          `Log: ${log}\n` +
          `Expected: ${this.isNot ? 'not' : ''}${this.utils.printExpected(expected)}\n` +
          (matcherResult
            ? `Received: ${this.utils.printReceived(matcherResult.actual)}`
            : '')
      : () =>
          this.utils.matcherHint(assertionName, undefined, undefined, {
            isNot: this.isNot,
          }) +
          '\n\n' +
          `Expected: ${this.utils.printExpected(expected)}\n` +
          (matcherResult
            ? `Received: ${this.utils.printReceived(matcherResult.actual)}`
            : '');

    return {
      message,
      pass,
      name: assertionName,
      expected,
      actual: matcherResult?.actual,
    };
  },
});
