/**
  * To learn more about Playwright Test visit:
  * https://www.checklyhq.com/docs/browser-checks/playwright-test/
  * https://playwright.dev/docs/writing-tests
  */

const { expect, test } = require('@playwright/test')

test('visit page and take screenshot', async ({ page }) => {
    // or, even better, define a ENVIRONMENT_URL environment variable
    // to reuse it across your browser checks
    const response = await page.goto(process.env.ENVIRONMENT_URL || 'https://angularexamples.wolsok.de')

    // Test that the response did not fail
    expect(response.status()).toBeLessThan(400)

    // Take a screenshot
    await page.screenshot({ path: 'screenshot.jpg' })
})
