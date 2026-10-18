/**
 * Helpers shared by the app icon generators: render HTML to a PNG with
 * Playwright's Chromium and pack PNGs into a favicon.ico.
 */
import { Page } from '@playwright/test';

/** Packs PNG images into one .ico container (PNG-in-ICO, every browser reads it). */
export function toIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize + entrySize * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

export async function render(
  page: Page,
  html: string,
  width: number,
  height: number,
  omitBackground: boolean
): Promise<Buffer> {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  return page.screenshot({ omitBackground, type: 'png' });
}
