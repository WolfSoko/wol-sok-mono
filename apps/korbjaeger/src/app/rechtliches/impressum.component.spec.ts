import { SITE_OWNER } from '@wolsok/shared-legal';
import { show } from '../../testing/show';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  it('names the provider from SITE_OWNER, with the VAT ID', () => {
    const seite = show(ImpressumComponent);

    expect(seite.querySelector('h1')?.textContent?.trim()).toBe('Impressum');
    const anbieter = seite
      .querySelector('wolsok-site-owner address')
      ?.textContent?.replace(/\s+/g, ' ');
    expect(anbieter).toContain(SITE_OWNER.name);
    for (const zeile of SITE_OWNER.addressLines) {
      expect(anbieter).toContain(zeile);
    }
    expect(anbieter).toContain(`E-Mail: ${SITE_OWNER.email}`);
    expect(seite.textContent).toContain(SITE_OWNER.vatId);
  });

  it('says where the data comes from and links the privacy policy', () => {
    const seite = show(ImpressumComponent);

    expect(seite.textContent).toContain('Deutschen Basketball Bund');
    expect(seite.querySelector('a[href="/privacy"]')?.textContent).toContain(
      'Datenschutzerklärung'
    );
  });
});
