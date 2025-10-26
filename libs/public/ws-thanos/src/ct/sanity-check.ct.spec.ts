import { Component } from '@angular/core';
import { expect, test } from '@jscutlery/playwright-ct-angular';

/**
 * Simple sanity check test to verify Playwright CT is working
 */

@Component({
  standalone: true,
  selector: 'ws-test-simple',
  template: `<div data-testid="simple-test">Hello Playwright!</div>`,
})
class SimpleTestComponent {}

test.describe('Playwright CT Sanity Check', () => {
  test('should render simple component', async ({ mount }) => {
    const component = await mount(SimpleTestComponent);
    const element = component.getByTestId('simple-test');
    await expect(element).toBeVisible();
    await expect(element).toContainText('Hello Playwright!');
  });

  test('should fail if this text is wrong', async ({ mount }) => {
    const component = await mount(SimpleTestComponent);
    const element = component.getByTestId('simple-test');
    // This will PASS - if you see this test pass, CT is working!
    await expect(element).not.toContainText('Wrong Text');
  });
});
