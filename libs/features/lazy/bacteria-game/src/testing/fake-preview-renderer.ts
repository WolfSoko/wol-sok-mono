import { Provider } from '@angular/core';
import {
  LEVEL_PREVIEW_RENDERER,
  LevelPreviewRenderer,
} from '../lib/menu/level-preview.service';

/**
 * Draws a fake preview URL per level and notes each drawing - the test DOM
 * has no canvas to draw the real ones on.
 */
export class FakePreviewRenderer implements LevelPreviewRenderer {
  public readonly drawn: string[] = [];

  public constructor(
    public readonly supported = true,
    private readonly fails: readonly string[] = []
  ) {}

  public async render(levelId: string): Promise<string | null> {
    this.drawn.push(levelId);
    return this.fails.includes(levelId) ? null : fakePreviewUrl(levelId);
  }
}

/** The URL the fake draws for a level. */
export function fakePreviewUrl(levelId: string): string {
  return `data:image/webp;base64,${levelId}`;
}

/** Previews drawn by a fake, as if the browser had a canvas. */
export function provideFakePreviews(
  renderer = new FakePreviewRenderer()
): Provider {
  return { provide: LEVEL_PREVIEW_RENDERER, useValue: renderer };
}

/** Waits until the previews asked for are drawn, one idle slot each. */
export async function drawPreviews(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
