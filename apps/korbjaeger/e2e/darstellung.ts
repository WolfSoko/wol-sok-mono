import type { Locator, Page } from '@playwright/test';
import { APPEARANCE_KEY } from '../src/app/device-storage';

/** Starts every page of `page` with the look `wahl` kept on the device. */
export async function mitDarstellung(
  page: Page,
  wahl: 'light' | 'dark'
): Promise<void> {
  await page.addInitScript(
    ([schluessel, wert]) => localStorage.setItem(schluessel, wert),
    [APPEARANCE_KEY, wahl] as const
  );
}

/**
 * Whether `element`'s own background is dark (relative luminance below
 * one half), as the browser computed it.
 */
export function hatDunklenHintergrund(element: Locator): Promise<boolean> {
  return element.evaluate((el) => {
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) {
      throw new Error('no canvas');
    }
    // the canvas turns any CSS colour (rgb, oklch, color()) into sRGB bytes
    probe.fillStyle = getComputedStyle(el).backgroundColor;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    const linear = (c: number): number => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.5;
  });
}
