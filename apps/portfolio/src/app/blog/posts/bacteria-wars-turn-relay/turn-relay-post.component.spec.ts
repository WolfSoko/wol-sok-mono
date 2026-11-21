import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { appRoutes } from '../../../app.routes';
import { I18nService } from '../../../i18n/i18n.service';
import { TURN_RELAY_FIGURES } from './figures';

const PATH = '/blog/bacteria-wars-turn-relay';
const PUBLIC = join(__dirname, '../../../../../public');

describe('TurnRelayPostComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(appRoutes)] });
  });

  afterEach(() => localStorage.clear());

  async function open(): Promise<{
    harness: RouterTestingHarness;
    root: HTMLElement;
  }> {
    const harness = await RouterTestingHarness.create(PATH);
    return { harness, root: harness.routeNativeElement as HTMLElement };
  }

  it('shows the article in English with its frame', async () => {
    const { root } = await open();
    expect(root.querySelector('h1')?.textContent).toContain('Through the wall');
    expect(root.querySelector('wolsok-turn-relay-en')).not.toBeNull();
    expect(root.textContent).toContain('How ICE picks a path');
    expect(root.querySelector('a[href="/blog"]')).not.toBeNull();
  });

  it('switches the text to German', async () => {
    const { harness, root } = await open();
    TestBed.inject(I18nService).setLanguage('de');
    harness.detectChanges();
    expect(root.querySelector('h1')?.textContent).toContain('Durch die Wand');
    expect(root.querySelector('wolsok-turn-relay-en')).toBeNull();
    expect(root.textContent).toContain('Wie ICE einen Weg wählt');
    expect(root.querySelector('img')?.getAttribute('src')).toBe(
      TURN_RELAY_FIGURES.walls.src.de
    );
  });

  it('shows every picture with its size and alt text', async () => {
    const { root } = await open();
    const images = [...root.querySelectorAll('img')];
    expect(images.map((image) => image.getAttribute('src'))).toEqual(
      Object.values(TURN_RELAY_FIGURES).map((figure) => figure.src.en)
    );
    expect(images.map((image) => image.getAttribute('loading'))).toEqual([
      'eager',
      ...Array<string>(images.length - 1).fill('lazy'),
    ]);
    for (const image of images) {
      expect(image.alt.length).toBeGreaterThan(20);
      expect(image.getAttribute('width')).toMatch(/^\d+$/);
      expect(image.getAttribute('height')).toMatch(/^\d+$/);
    }
  });

  it('gives every picture a file, its size and texts in both languages', () => {
    for (const figure of Object.values(TURN_RELAY_FIGURES)) {
      for (const text of [figure.src, figure.alt, figure.caption]) {
        expect(text.en.trim()).not.toBe('');
        expect(text.de.trim()).not.toBe('');
      }
      expect(existsSync(join(PUBLIC, figure.src.en))).toBe(true);
      expect(existsSync(join(PUBLIC, figure.src.de))).toBe(true);
    }
  });

  it('carries the BlogPosting data in the head only while it is open', async () => {
    const { harness } = await open();
    const script = document.getElementById('blog-post-json-ld');
    expect(JSON.parse(script?.textContent ?? '{}')).toMatchObject({
      '@type': 'BlogPosting',
      datePublished: '2026-11-20',
    });

    await harness.navigateByUrl('/blog');
    expect(document.getElementById('blog-post-json-ld')).toBeNull();
  });

  it('links the call to action of the post at its end', async () => {
    const { root } = await open();
    expect(
      root.querySelector('.article-foot a[href^="https"]')?.getAttribute('href')
    ).toBe('https://bacteria-wars.wolsok.de');
  });
});
