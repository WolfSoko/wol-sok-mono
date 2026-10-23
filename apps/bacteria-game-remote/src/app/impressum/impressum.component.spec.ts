import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LEGAL_NOTICE_URL } from '@wolsok/feat-lazy-bac-game';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'impressum', component: ImpressumComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
  });

  async function open(): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum', ImpressumComponent);
    return harness.routeNativeElement as HTMLElement;
  }

  it('names the provider in German and English, with a way to reach them', async () => {
    const page = await open();

    expect(page.querySelector('article[lang="de"] h1')?.textContent).toBe(
      'Impressum'
    );
    expect(page.querySelector('article[lang="en"] h1')?.textContent).toBe(
      'Legal notice'
    );
    const owner = page.querySelector('address')?.textContent ?? '';
    expect(owner).toContain('Wolfram Sokollek');
    expect(owner).toContain('privacy@wolsok.de');
    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('has its own title, description and canonical URL while open', async () => {
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    const doc = TestBed.inject(DOCUMENT);
    title.setTitle('Bacteria Game');
    meta.updateTag({ name: 'description', content: 'The game' });

    await open();

    expect(title.getTitle()).toBe('Impressum - Bacteria Wars');
    expect(meta.getTag('name="description"')?.content).toContain(
      'Legal notice of Bacteria Wars'
    );
    // The footer of the game links here.
    expect(
      doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe(LEGAL_NOTICE_URL);

    await TestBed.inject(Router).navigateByUrl('/');

    expect(title.getTitle()).toBe('Bacteria Game');
    expect(meta.getTag('name="description"')?.content).toBe('The game');
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('takes the loading screen down', async () => {
    const doc = TestBed.inject(DOCUMENT);
    const splash = doc.createElement('div');
    splash.id = 'bacteria-game-splash';
    doc.body.append(splash);

    await open();

    expect(doc.getElementById('bacteria-game-splash')).toBeNull();
  });
});
