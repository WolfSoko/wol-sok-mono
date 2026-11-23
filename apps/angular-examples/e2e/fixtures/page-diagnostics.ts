import { test as base, type Page, type TestInfo } from '@playwright/test';
import { redactUrls, urlForLog } from '@wolsok/shared-e2e-server';

export { expect } from '@playwright/test';

/** Responses from this status on count as failed. */
const FIRST_ERROR_STATUS = 400;
const ATTACHMENT_NAME = 'page-diagnostics.txt';

/**
 * Records what went wrong in the page while the test ran, and on a failure
 * prints it (stdout lands in the Nx Cloud task log) and attaches it to the
 * report. Each line holds only URLs, status codes and messages, every URL
 * (in messages too) without credentials, query and hash (`urlForLog`,
 * `redactUrls`): the CI log is public, so no headers, bodies or parameters.
 */
export const test = base.extend<{ pageDiagnostics: string[] }>({
  pageDiagnostics: [
    async ({ page }, use, testInfo) => {
      const lines = recordProblems(page);
      await use(lines);
      await reportOnFailure(lines, testInfo);
    },
    { auto: true },
  ],
});

function recordProblems(page: Page): string[] {
  const lines: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      lines.push(`console error: ${redactUrls(message.text())}`);
    }
  });
  page.on('pageerror', (error) =>
    lines.push(`page error: ${redactUrls(error.message)}`)
  );
  page.on('requestfailed', (request) =>
    lines.push(
      `request failed: ${urlForLog(request.url())} (${redactUrls(request.failure()?.errorText ?? 'unknown')})`
    )
  );
  page.on('response', (response) => {
    if (response.status() >= FIRST_ERROR_STATUS) {
      lines.push(`response ${response.status()}: ${urlForLog(response.url())}`);
    }
  });
  return lines;
}

async function reportOnFailure(
  lines: readonly string[],
  testInfo: TestInfo
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const report = lines.length > 0 ? lines.join('\n') : 'nothing recorded';
  console.log(`Page diagnostics of "${testInfo.title}":\n${report}`);
  await testInfo.attach(ATTACHMENT_NAME, {
    body: report,
    contentType: 'text/plain',
  });
}
