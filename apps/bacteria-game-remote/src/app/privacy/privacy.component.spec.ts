import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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

  it('has its own title while open', async () => {
    await open();

    expect(TestBed.inject(Title).getTitle()).toBe(
      'Datenschutz - Bacteria Wars'
    );
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
