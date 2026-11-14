import type { Locator, Page } from '@playwright/test';
import { APPEARANCE_KEY } from '../src/app/device-storage';

/** Starts every page of `page` with the look `choice` kept on the device. */
export async function withAppearance(
  page: Page,
  choice: 'light' | 'dark'
): Promise<void> {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    APPEARANCE_KEY,
    choice,
  ] as const);
}

/**
 * Whether `element`'s own background is dark (relative luminance below
 * one half), as the browser computed it.
 */
export function hasDarkBackground(element: Locator): Promise<boolean> {
  return element.evaluate((el) => {
    const sample = document.createElement('canvas').getContext('2d');
    if (!sample) {
      throw new Error('no canvas');
    }
    // the canvas turns any CSS colour (rgb, oklch, color()) into sRGB bytes
    sample.fillStyle = getComputedStyle(el).backgroundColor;
    sample.fillRect(0, 0, 1, 1);
    const [r, g, b] = sample.getImageData(0, 0, 1, 1).data;
    const linear = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.5;
  });
}
