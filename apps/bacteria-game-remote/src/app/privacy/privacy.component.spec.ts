import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PRIVACY_POLICY_URL } from '@wolsok/feat-lazy-bac-game';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  let scrolledTo: string[];

  beforeEach(() => {
    scrolledTo = [];
    // jsdom has no layout, so no scrollIntoView either.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this.id);
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'privacy', component: PrivacyComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
  });

  async function open(url = '/privacy'): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PrivacyComponent);
    return harness.routeNativeElement as HTMLElement;
  }

  it('is in German and English, and says whom to write to', async () => {
    const page = await open();

    expect(page.querySelector('article[lang="de"] h1')?.textContent).toBe(
      'Datenschutzerklärung'
    );
    expect(page.querySelector('article[lang="en"] h1')?.textContent).toBe(
      'Privacy policy'
    );
    expect(page.querySelector('address')?.textContent).toContain(
      'privacy@wolsok.de'
    );
  });

  it('has its own title, description and canonical URL while open', async () => {
    const title = TestBed.inject(Title);
    const meta = TestBed.inject(Meta);
    const doc = TestBed.inject(DOCUMENT);
    title.setTitle('Bacteria Game');
    meta.updateTag({ name: 'description', content: 'The game' });

    await open();

    expect(title.getTitle()).toBe('Datenschutz - Bacteria War');
    expect(meta.getTag('name="description"')?.content).toContain(
      'Privacy policy of Bacteria War'
    );
    expect(
      doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
    ).toBe(PRIVACY_POLICY_URL);

    await TestBed.inject(Router).navigateByUrl('/');

    expect(title.getTitle()).toBe('Bacteria Game');
    expect(meta.getTag('name="description"')?.content).toBe('The game');
    expect(doc.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('takes the loading screen down, as no game will', async () => {
    const doc = TestBed.inject(DOCUMENT);
    const splash = doc.createElement('div');
    splash.id = 'bacteria-game-splash';
    doc.body.append(splash);

    await open();

    expect(splash.isConnected).toBe(false);
  });

  it('scrolls to the section a link names', async () => {
    await open('/privacy#en-delete');

    expect(scrolledTo).toContain('en-delete');
  });

  it('scrolls to a language on every click, the same one again too', async () => {
    const page = await open('/privacy#de');
    scrolledTo = [];

    page.querySelector<HTMLAnchorElement>('nav a[hreflang="de"]')?.click();

    expect(scrolledTo).toEqual(['de']);
  });
});
