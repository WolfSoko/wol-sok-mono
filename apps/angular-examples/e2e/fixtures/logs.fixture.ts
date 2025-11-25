import { test as testBase } from '@playwright/test';
import { ConsoleMessage } from '@playwright/test';

interface LogsFixture {
  logs: ConsoleMessage[];
}

export const test = testBase.extend<LogsFixture>({
  logs: async ({ page }, use) => {
    const logs: ConsoleMessage[] = [];
    page.on('console', (msg) => logs.push(msg));
    await use(logs);
  },
});

export { expect } from '@playwright/test';

// Custom matcher for console messages
export async function toHaveConsoleMsg(
  logs: ConsoleMessage[],
  expectedMsg: string
): Promise<{ pass: boolean; message: () => string }> {
  const messages = await Promise.all(
    logs.map((log) => log.text())
  );
  const pass = messages.some((msg) => msg.includes(expectedMsg));
  
  return {
    pass,
    message: () =>
      pass
        ? `Expected console logs NOT to contain "${expectedMsg}"`
        : `Expected console logs to contain "${expectedMsg}". Got: ${messages.join(', ')}`,
  };
}

// Extend expect with custom matcher
export const expectLogs = (logs: ConsoleMessage[]) => ({
  toHaveConsoleMsg: async (expectedMsg: string) =>
    toHaveConsoleMsg(logs, expectedMsg),
});
