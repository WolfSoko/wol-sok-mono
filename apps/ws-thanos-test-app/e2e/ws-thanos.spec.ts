import { test, expect } from '@playwright/test';

test.describe('WsThanos Directive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(
      'WsThanos Directive Test Application'
    );
  });

  test('should render the test application', async ({ page }) => {
    await expect(page.getByTestId('vaporize-remove')).toBeVisible();
    await expect(page.getByTestId('vaporize-restore')).toBeVisible();
    await expect(page.getByTestId('btn-vaporize-remove')).toBeVisible();
    await expect(page.getByTestId('btn-vaporize-restore')).toBeVisible();
  });

  test('should vaporize and remove element from DOM', async ({ page }) => {
    const target = page.getByTestId('vaporize-remove');
    const button = page.getByTestId('btn-vaporize-remove');

    // Element should be visible initially
    await expect(target).toBeVisible();
    await expect(target).toHaveCSS('opacity', '1');

    // Click vaporize button
    await button.click();

    // Wait a bit for animation to start
    await page.waitForTimeout(200);

    // Check opacity is decreasing (animation in progress)
    const opacity = await target.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(opacity)).toBeLessThan(1);

    // Wait for animation to complete and element to be removed
    await page.waitForTimeout(1500);

    // Element should be removed from DOM
    await expect(target).not.toBeAttached();

    // Completion event should have fired
    await expect(page.getByTestId('status-test1')).toBeVisible();
  });

  test('should vaporize and restore element (fade back in)', async ({
    page,
  }) => {
    const target = page.getByTestId('vaporize-restore');
    const button = page.getByTestId('btn-vaporize-restore');

    // Element should be visible initially
    await expect(target).toBeVisible();
    await expect(target).toHaveCSS('opacity', '1');

    // Click vaporize button
    await button.click();

    // Wait a bit for animation to start
    await page.waitForTimeout(200);

    // Check opacity is decreasing
    const opacityDuring = await target.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(opacityDuring)).toBeLessThan(1);

    // Wait for vaporization animation to complete
    await page.waitForTimeout(1500);

    // Element should still be attached (not removed)
    await expect(target).toBeAttached();

    // Wait for fade back transition
    await page.waitForTimeout(1000);

    // Element should be faded back to opacity 1 (or close to it)
    const finalOpacity = await target.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    expect(parseFloat(finalOpacity)).toBeGreaterThan(0.9);

    // Completion event should have fired
    await expect(page.getByTestId('status-test2')).toBeVisible();
  });

  test('should create canvas overlay during vaporization', async ({ page }) => {
    const button = page.getByTestId('btn-vaporize-remove');

    // No canvas should exist initially
    let canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBe(0);

    // Click vaporize button
    await button.click();

    // Wait for animation to start
    await page.waitForTimeout(300);

    // Canvas should be created for particle effect
    canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    // Wait for animation to complete
    await page.waitForTimeout(1500);

    // Canvas should be cleaned up after animation
    canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBe(0);
  });

  test('should vaporize multiple elements simultaneously', async ({ page }) => {
    const element1 = page.getByTestId('vaporize-multi-1');
    const element2 = page.getByTestId('vaporize-multi-2');
    const element3 = page.getByTestId('vaporize-multi-3');
    const button = page.getByTestId('btn-vaporize-multi');

    // All elements should be visible initially
    await expect(element1).toBeVisible();
    await expect(element2).toBeVisible();
    await expect(element3).toBeVisible();

    // Click button to vaporize all
    await button.click();

    // Wait for animation to start
    await page.waitForTimeout(200);

    // All should be fading
    const opacity1 = await element1.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const opacity2 = await element2.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );
    const opacity3 = await element3.evaluate(
      (el) => window.getComputedStyle(el).opacity
    );

    expect(parseFloat(opacity1)).toBeLessThan(1);
    expect(parseFloat(opacity2)).toBeLessThan(1);
    expect(parseFloat(opacity3)).toBeLessThan(1);

    // Wait for animation to complete
    await page.waitForTimeout(1500);

    // All elements should be removed
    await expect(element1).not.toBeAttached();
    await expect(element2).not.toBeAttached();
    await expect(element3).not.toBeAttached();
  });

  test('should handle rapid consecutive vaporizations', async ({ page }) => {
    const target = page.getByTestId('vaporize-remove');
    const button = page.getByTestId('btn-vaporize-remove');

    await expect(target).toBeVisible();

    // Click multiple times rapidly
    await button.click();
    await button.click();
    await button.click();

    // Should still complete successfully
    await page.waitForTimeout(2000);
    await expect(target).not.toBeAttached();
  });
});
