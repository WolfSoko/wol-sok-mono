import { expect, Locator, Page, test } from '@playwright/test';

const EFFECT_CANVAS = 'canvas[data-ws-thanos-renderer]';

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
  test('should render the particles on the GPU', async ({ page }) => {
    await page.getByTestId('btn-vaporize-restore').click();

    // the renderer reports itself, a fallback to the canvas would show here
    await expect(effectCanvas(page)).toHaveAttribute(
      'data-ws-thanos-renderer',
      'webgl'
    );
  });

  test('should place the particles exactly over the element', async ({
    page,
  }) => {
    // clicking scrolls the page, so measure afterwards
    await page.getByTestId('btn-vaporize-restore').click();
    await expect(effectCanvas(page)).toBeAttached();
    const element = await page.getByTestId('vaporize-restore').boundingBox();
    const canvas = await effectCanvas(page).boundingBox();

    // the particles start at the bottom left of the effect canvas
    expect(canvas?.x).toBeCloseTo(element?.x ?? NaN, 0);
    expect((canvas?.y ?? 0) + (canvas?.height ?? 0)).toBeCloseTo(
      (element?.y ?? 0) + (element?.height ?? 0),
      0
    );
  });

  test('should draw visible particles on the GPU canvas', async ({ page }) => {
    await page.getByTestId('btn-vaporize-restore').click();
    await expect(effectCanvas(page)).toBeAttached();
    await page.waitForTimeout(150);
    await showOnlyEffectCanvas(page);

    const screenshot = await effectCanvas(page).screenshot({
      omitBackground: true,
    });
    const alphas = await alphaValues(page, screenshot);
    expect(alphas.filter((alpha) => alpha > 0).length).toBeGreaterThan(50);
  });

  test('should play the snap sound after a click', async ({ page }) => {
    await page.addInitScript(() => {
      const record = window as unknown as { startedSounds: number };
      record.startedSounds = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (
        ...args: Parameters<AudioBufferSourceNode['start']>
      ) {
        record.startedSounds++;
        return start.apply(this, args);
      };
    });
    await page.reload();

    await page.getByTestId('btn-vaporize-restore').click();

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { startedSounds: number }).startedSounds
        )
      )
      .toBeGreaterThan(0);
  });

  test.describe('crumble variants', () => {
    const variants = ['dust', 'cracks', 'shards', 'chunks'] as const;

    test.beforeEach(async ({ page }) => {
      await page.goto('/?demo');
    });

    for (const variant of variants) {
      test(`should crumble with ${variant} on the GPU`, async ({ page }) => {
        await page.getByTestId(`btn-crumble-${variant}`).click();

        await expect(effectCanvas(page)).toHaveAttribute(
          'data-ws-thanos-crumble',
          variant
        );
        await expect(effectCanvas(page)).toHaveAttribute(
          'data-ws-thanos-renderer',
          'webgl'
        );
      });
    }

    for (const variant of variants) {
      const cracks = variant !== 'dust';
      test(`should ${cracks ? '' : 'not '}crack ${variant} before the front reaches it`, async ({
        page,
      }) => {
        const card = page.getByTestId(`crumble-${variant}`);
        await card.scrollIntoViewIfNeeded();
        await page.getByTestId(`btn-crumble-${variant}`).click();
        await expect(effectCanvas(page)).toBeAttached();
        // 15% of the 10s demo animation, the front is still far from the bottom left
        await page.waitForTimeout(1500);
        const box = await card.boundingBox();
        if (box == null) {
          throw new Error('card not visible');
        }
        await showOnlyEffectCanvas(page);

        // the bottom left quarter of the card
        const screenshot = await page.screenshot({
          omitBackground: true,
          clip: {
            x: box.x + 4,
            y: box.y + box.height / 2,
            width: box.width / 2 - 4,
            height: box.height / 2 - 4,
          },
        });
        const alphas = await alphaValues(page, screenshot);
        const holes =
          alphas.filter((alpha) => alpha < 128).length / alphas.length;

        if (cracks) {
          expect(holes).toBeGreaterThan(0.01);
        } else {
          expect(holes).toBeLessThan(0.002);
        }
      });
    }

    test('should vaporize all variants at once', async ({ page }) => {
      await page.getByTestId('btn-crumble-all').click();

      await expect(effectCanvas(page)).toHaveCount(4);
    });
  });

  test.describe('playground', () => {
    test('should vaporize with the chosen options', async ({ page }) => {
      await page.goto('/?demo');
      await page.getByTestId('playground-crumble').selectOption('chunks');

      await page.getByTestId('btn-playground').click();

      await expect(effectCanvas(page)).toHaveAttribute(
        'data-ws-thanos-crumble',
        'chunks'
      );
    });
  });
});

/** the canvases the particles are drawn on */
function effectCanvas(page: Page): Locator {
  return page.locator(EFFECT_CANVAS);
}

/** hide everything but the particles, so screenshots only show them */
async function showOnlyEffectCanvas(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      body * { visibility: hidden !important; }
      ${EFFECT_CANVAS} { visibility: visible !important; }
    `,
  });
}

/** the alpha value of every pixel of a png screenshot */
function alphaValues(page: Page, png: Buffer): Promise<number[]> {
  return page.evaluate(async (base64) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext(
      '2d'
    ) as OffscreenCanvasRenderingContext2D;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return Array.from(data.filter((_, i) => i % 4 === 3));
  }, png.toString('base64'));
}
