import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GAME_SUPPORT_OPTIONS } from '../../testing/game-support-options';
import { I18nService } from '../i18n/i18n.service';
import { GameAds } from './ads/game-ads.service';
import { GAME_SUPPORT } from './game-support';
import { SiteFooterComponent } from './site-footer.component';

describe('SiteFooterComponent', () => {
  let ads: {
    consentAnswered: GameAds['consentAnswered'];
    openConsentSettings: jest.Mock;
  };

  beforeEach(() => {
    ads = { consentAnswered: signal(false), openConsentSettings: jest.fn() };
  });

  function render(): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: GAME_SUPPORT, useValue: GAME_SUPPORT_OPTIONS },
        { provide: GameAds, useValue: ads },
      ],
    });
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('names the owner and links to the privacy policy and the legal notice', () => {
    const host = render();
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('a'));

    expect(host.textContent).toContain(
      `© ${new Date().getFullYear()} ${GAME_SUPPORT_OPTIONS.siteOwner}`
    );
    // Routes of the site's own app, so the game is not torn down on the way.
    expect(
      links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])
    ).toEqual([
      ['Privacy policy', '/privacy'],
      ['Legal notice', '/impressum'],
    ]);
    expect(host.querySelector('button')).toBeNull();
  });

  it('opens the ad consent settings once the banner was answered', () => {
    ads.consentAnswered = signal(true);
    const host = render();

    const button = host.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent?.trim()).toBe('Ad privacy settings');
    button?.click();
    expect(ads.openConsentSettings).toHaveBeenCalled();
  });

  it('speaks German', () => {
    const host = render();
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(host.textContent).toContain('Datenschutz');
    expect(host.textContent).toContain('Impressum');
  });
});
