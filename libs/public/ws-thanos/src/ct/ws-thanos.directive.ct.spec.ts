import { Component } from '@angular/core';
import { expect, test } from '@jscutlery/playwright-ct-angular';
import { provideWsThanosOptions } from '../lib/ws-thanos-options.token';
import { WsThanosDirective } from '../lib/ws-thanos.directive';

/**
 * Playwright Component Tests for WsThanosDirective
 *
 * These tests run in a real browser environment (Chromium) to validate
 * directive behavior that requires browser features like html2canvas,
 * canvas rendering, and getComputedStyle.
 */

/**
 * Test host component that uses the directive
 */
@Component({
  standalone: true,
  selector: 'ws-thanos-test-host',
  template: `
    <div
      class="test-container"
      wsThanos
      #thanos="thanos"
      data-testid="vaporize-target"
    >
      <h1>Test Content</h1>
      <p>This element will be vaporized</p>
    </div>
    <button
      (click)="startVaporize()"
      data-testid="vaporize-button"
    >
      Vaporize
    </button>
  `,
  styles: [
    `
      .test-container {
        padding: 20px;
        background: linear-gradient(to right, #667eea, #764ba2);
        color: white;
        border-radius: 8px;
        min-height: 100px;
        min-width: 200px;
      }

      h1 {
        margin: 0 0 10px 0;
        font-size: 24px;
      }

      p {
        margin: 0;
      }
    `,
  ],
  imports: [WsThanosDirective],
  providers: [
    provideWsThanosOptions({
      maxParticleCount: 100,
      animationLength: 500, // Short duration for fast tests
      particleAcceleration: 1000,
    }),
  ],
})
class WsThanosTestHostComponent {
  vaporizeCompleted = false;
  vaporizeStarted = false;

  startVaporize() {
    this.vaporizeStarted = true;
  }
}

test.describe('WsThanosDirective', () => {
  test('should render the directive and target element', async ({ mount }) => {
    const component = await mount(WsThanosTestHostComponent);

    // Verify the target element is visible
    const target = component.getByTestId('vaporize-target');
    await expect(target).toBeVisible();
    await expect(target).toContainText('Test Content');
    await expect(target).toContainText('This element will be vaporized');

    // Verify button exists
    const button = component.getByTestId('vaporize-button');
    await expect(button).toBeVisible();
  });

  test('should vaporize element when triggered programmatically', async ({
    mount,
    page,
  }) => {
    const component = await mount(WsThanosTestHostComponent);
    const target = component.getByTestId('vaporize-target');

    // Verify initial state - element is visible
    await expect(target).toBeVisible();
    await expect(target).toHaveCSS('opacity', '1');

    // Trigger vaporization by calling the directive's vaporize method
    await page.evaluate(() => {
      const hostElement = document.querySelector('ws-thanos-test-host');
      const targetElement = hostElement?.querySelector('[wsThanos]') as any;
      const directive = (targetElement as any).__ngContext__?.[8]; // Access directive from Angular context

      // Find directive instance through the element
      if (targetElement) {
        // Get all directives/components on the element
        const context = (targetElement as any).__ngContext__;
        if (Array.isArray(context)) {
          // Find the directive instance
          const directiveInstance = context.find(
            (item) => item?.vaporize$ !== undefined
          );
          if (directiveInstance) {
            // Call vaporize with removeElem=false to keep element for testing
            directiveInstance.vaporize(false);
          }
        }
      }
    });

    // Wait for animation to start - opacity should decrease
    await page.waitForTimeout(200);

    // Check that opacity has decreased (animation in progress)
    const opacityDuringAnimation = await target.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(opacityDuringAnimation)).toBeLessThan(1);

    // Wait for animation to complete (500ms + buffer)
    await page.waitForTimeout(800);

    // After animation completes with removeElem=false, element should fade back to opacity 1
    // Give it time for the fade back transition
    await page.waitForTimeout(1000);

    // Element should be visible again (faded back in)
    const finalOpacity = await target.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    // Should be close to 1 (may be transitioning)
    expect(parseFloat(finalOpacity)).toBeGreaterThan(0.9);
  });

  test('should remove element when vaporize is called with removeElem=true', async ({
    mount,
    page,
  }) => {
    const component = await mount(WsThanosTestHostComponent);
    const target = component.getByTestId('vaporize-target');

    // Verify initial state
    await expect(target).toBeVisible();

    // Trigger vaporization with removeElem=true
    await page.evaluate(() => {
      const hostElement = document.querySelector('ws-thanos-test-host');
      const targetElement = hostElement?.querySelector('[wsThanos]') as any;

      if (targetElement) {
        const context = (targetElement as any).__ngContext__;
        if (Array.isArray(context)) {
          const directiveInstance = context.find(
            (item) => item?.vaporize$ !== undefined
          );
          if (directiveInstance) {
            // Call vaporize with removeElem=true (default)
            directiveInstance.vaporize(true);
          }
        }
      }
    });

    // Wait for animation to complete
    await page.waitForTimeout(800);

    // Element should be removed from DOM
    await expect(target).not.toBeAttached();
  });

  test('should create canvas overlay during vaporization', async ({
    mount,
    page,
  }) => {
    const component = await mount(WsThanosTestHostComponent);
    const target = component.getByTestId('vaporize-target');

    await expect(target).toBeVisible();

    // Trigger vaporization
    await page.evaluate(() => {
      const hostElement = document.querySelector('ws-thanos-test-host');
      const targetElement = hostElement?.querySelector('[wsThanos]') as any;

      if (targetElement) {
        const context = (targetElement as any).__ngContext__;
        if (Array.isArray(context)) {
          const directiveInstance = context.find(
            (item) => item?.vaporize$ !== undefined
          );
          if (directiveInstance) {
            directiveInstance.vaporize(false);
          }
        }
      }
    });

    // Wait a bit for canvas creation
    await page.waitForTimeout(200);

    // Check that a canvas element was created during animation
    const canvasExists = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return canvases.length > 0;
    });

    expect(canvasExists).toBe(true);

    // Wait for animation to complete
    await page.waitForTimeout(800);
  });
});
