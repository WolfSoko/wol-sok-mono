import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SITE_OWNER } from '@wolsok/shared-legal';
import ImpressumPageComponent from './impressum.page';

describe('ImpressumPageComponent', () => {
  async function render(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'impressum', component: ImpressumPageComponent },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/impressum');
    return harness.routeNativeElement as HTMLElement;
  }

  function text(element: Element | null | undefined): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ');
  }

  it('names the provider with the postal address, the email and the VAT ID', async () => {
    const page = await render();

    const provider = text(
      page.querySelector('[data-testid="legal-notice-provider"]')
    );
    for (const part of [SITE_OWNER.name, ...SITE_OWNER.addressLines]) {
      expect(provider).toContain(part);
    }
    expect(provider).toContain(`Email: ${SITE_OWNER.email}`);
    expect(text(page)).toContain(SITE_OWNER.vatId);
  });

  it('names the point of contact under the Digital Services Act, and where to report content', async () => {
    const notice = text(await render());

    expect(notice).toContain(
      'single point of contact for authorities and for users under Articles 11 and 12 of the Digital Services Act'
    );
    expect(notice).toContain(
      'To report a poll or a message that breaks the law'
    );
  });

  it('links to the privacy policy', async () => {
    const page = await render();

    expect(page.querySelector('a[href="/privacy"]')).not.toBeNull();
  });

  it('has its own title, description and canonical URL', async () => {
    await render();

    expect(TestBed.inject(Title).getTitle()).toBe(
      'Legal notice (Impressum) | RollaPolla'
    );
    expect(
      TestBed.inject(Meta).getTag('name="description"')?.content
    ).toContain('Who runs RollaPolla');
    expect(TestBed.inject(Meta).getTag('property="og:url"')?.content).toBe(
      'https://rollapolla.com/impressum'
    );
  });
});
