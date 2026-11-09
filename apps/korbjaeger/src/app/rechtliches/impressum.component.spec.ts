import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SITE_OWNER } from '@wolsok/shared-legal';
import { ImpressumComponent } from './impressum.component';

describe('ImpressumComponent', () => {
  function zeigen(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ImpressumComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names the provider from SITE_OWNER, with the VAT ID', () => {
    const seite = zeigen();

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
    const seite = zeigen();

    expect(seite.textContent).toContain('Deutschen Basketball Bund');
    expect(seite.querySelector('a[href="/privacy"]')?.textContent).toContain(
      'Datenschutzerklärung'
    );
  });
});
