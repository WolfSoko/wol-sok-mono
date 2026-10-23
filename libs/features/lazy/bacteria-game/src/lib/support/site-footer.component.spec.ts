import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
import { GameAds } from './game-ads.service';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';
import { LEGAL_NOTICE_URL, PRIVACY_POLICY_URL } from './legal-links';
import { SiteFooterComponent } from './site-footer.component';

const OPTIONS: GameSupportOptions = {
  buyMeACoffeeHandle: 'wolf',
  playTipProductIds: [],
  androidPackage: 'de.wolsok.bacteriawars',
  ads: null,
};

describe('SiteFooterComponent', () => {
  const consentAnswered = signal(false);
  const openConsentSettings = jest.fn();

  beforeEach(() => {
    consentAnswered.set(false);
    openConsentSettings.mockClear();
  });

  function render(options: GameSupportOptions | null = OPTIONS): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        { provide: GAME_SUPPORT, useValue: options },
        {
          provide: GameAds,
          useValue: { consentAnswered, openConsentSettings },
        },
      ],
    });
    const fixture = TestBed.createComponent(SiteFooterComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("links to the privacy policy and the legal notice on the game's own site", () => {
    const host = render();
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('a'));

    expect(host.textContent).toContain(
      `© ${new Date().getFullYear()} Wolfram Sokollek`
    );
    expect(links.map((a) => [a.textContent?.trim(), a.href])).toEqual([
      ['Privacy policy', PRIVACY_POLICY_URL],
      ['Legal notice', LEGAL_NOTICE_URL],
    ]);
    expect(host.querySelector('button')).toBeNull();
  });

  it('opens the ad consent settings once the banner was answered', () => {
    consentAnswered.set(true);
    const host = render();

    const button = host.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent?.trim()).toBe('Ad privacy settings');
    button?.click();
    expect(openConsentSettings).toHaveBeenCalled();
  });

  it('speaks German', () => {
    const host = render();
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(host.textContent).toContain('Datenschutz');
    expect(host.textContent).toContain('Impressum');
  });

  it('shows nothing inside the shell, which has pages of its own', () => {
    expect(render(null).querySelector('footer')).toBeNull();
  });
});
