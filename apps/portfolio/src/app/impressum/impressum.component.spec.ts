import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SITE_OWNER } from '@wolsok/shared-legal';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'impressum', component: ImpressumComponent }]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum');
    return harness.routeNativeElement as HTMLElement;
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ');
  }

  it('names the provider with the postal address, the email and the VAT ID, in German and English', async () => {
    const page = await render();

    const articles = page.querySelectorAll('article');
    expect(articles).toHaveLength(2);
    for (const article of articles) {
      expect(article.textContent).toContain(SITE_OWNER.vatId);
    }
    for (const [language, emailLabel] of [
      ['de', 'E-Mail'],
      ['en', 'Email'],
    ]) {
      const provider = text(
        page.querySelector(`[data-testid="impressum-provider-${language}"]`)
      );
      for (const part of [SITE_OWNER.name, ...SITE_OWNER.addressLines]) {
        expect(provider).toContain(part);
      }
      expect(provider).toContain(`${emailLabel}: ${SITE_OWNER.email}`);
    }
  });

  it('links to the privacy policy', async () => {
    const page = await render();

    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull();
  });
});
