import { SITE_OWNER } from '@wolsok/shared-legal';
import { show } from '../../testing/show';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  it('names the provider from SITE_OWNER, with the VAT ID', () => {
    const page = show(ImpressumComponent);

    expect(page.querySelector('h1')?.textContent?.trim()).toBe('Impressum');
    const provider = page
      .querySelector('wolsok-site-owner address')
      ?.textContent?.replace(/\s+/g, ' ');
    expect(provider).toContain(SITE_OWNER.name);
    for (const row of SITE_OWNER.addressLines) {
      expect(provider).toContain(row);
    }
    expect(provider).toContain(`E-Mail: ${SITE_OWNER.email}`);
    expect(page.textContent).toContain(SITE_OWNER.vatId);
  });

  it('says where the data comes from and links the privacy policy', () => {
    const page = show(ImpressumComponent);

    expect(page.textContent).toContain('Deutschen Basketball Bund');
    expect(page.querySelector('a[href="/privacy"]')?.textContent).toContain(
      'Datenschutzerklärung'
    );
  });
});
