import { TestBed } from '@angular/core/testing';
import { GameAds } from '../support/ads/game-ads.service';
import { GAME_SUPPORT } from '../support/game-support';
import { GameSupport } from '../support/game-support.service';
import { I18nService } from '../i18n/i18n.service';
import {
  ADSENSE_ADS,
  GAME_SUPPORT_OPTIONS,
} from '../../testing/game-support-options';
import { PRIVACY_POLICY_URL } from '../support/legal-links';
import { HelpComponent } from './help.component';

describe('HelpComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.componentRef.setInput('colorNames', ['Orange', 'Blue']);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('explains evolution: the DNA, the genes, the weapons and where they count', () => {
    const section = render().querySelector('.evolution');

    expect(section?.querySelector('h3')?.textContent?.trim()).toBe('Evolution');
    expect(section?.textContent).toContain('Every 50 XP you earn');
    expect(section?.textContent).toContain('second button next to the boost');
    expect(section?.textContent).toContain('daily level, endless runs');
  });

  it('names the weapon keys for the one weapon a match ever arms', () => {
    const keys = render().querySelector('.weapon-keys');

    expect(keys?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'In a match against the computer, E or the right Shift fires your weapon.'
    );
  });

  it('links to the privacy policy in a tab of its own', () => {
    const host = render();

    const link = host.querySelector<HTMLAnchorElement>(
      `a[href="${PRIVACY_POLICY_URL}"]`
    );

    expect(link?.textContent?.trim()).toBe('privacy policy');
    expect(link?.target).toBe('_blank');
  });

  it('explains the keys and the ground in German, the colours named in it', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.componentRef.setInput('colorNames', ['Orange', 'Blue']);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Spielanleitung');
    expect(text).toContain('Blau die');
    expect(text).toContain('Bakterien teilen sich doppelt so schnell.');
    expect(text.replace(/\s+/g, ' ')).toContain(
      'Im Match gegen den Computer feuert E oder die rechte Umschalttaste deine Waffe ab.'
    );
    expect(text).toContain('Datenschutzerklärung');
  });

  it('asks for no support and has no ad settings where the game has neither', () => {
    const host = render();

    expect(host.textContent).not.toContain('Support the game');
    expect(host.textContent).not.toContain('Ad privacy settings');
  });

  it('asks for support and opens the ad consent again where the game has both', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GAME_SUPPORT,
          useValue: {
            ...GAME_SUPPORT_OPTIONS,
            ads: ADSENSE_ADS,
          },
        },
      ],
    });
    jest
      .spyOn(TestBed.inject(GameSupport), 'url')
      .mockReturnValue('https://buymeacoffee.com/wolf');
    const ads = TestBed.inject(GameAds);
    jest.spyOn(ads, 'consentAnswered').mockReturnValue(true);
    const reopen = jest
      .spyOn(ads, 'openConsentSettings')
      .mockImplementation(() => undefined);

    const host = render();
    const settings = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ad privacy settings')
    );
    settings?.click();

    expect(host.textContent).toContain('Support the game');
    expect(
      host.querySelector('a[href="https://buymeacoffee.com/wolf"]')
    ).not.toBeNull();
    expect(reopen).toHaveBeenCalled();
  });
});
