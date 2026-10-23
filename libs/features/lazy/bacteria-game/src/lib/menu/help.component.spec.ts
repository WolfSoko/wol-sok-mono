import { TestBed } from '@angular/core/testing';
import { GameAds } from '../support/game-ads.service';
import { GAME_SUPPORT } from '../support/game-support';
import { GameSupport } from '../support/game-support.service';
import { HelpComponent, PRIVACY_POLICY_URL } from './help.component';

describe('HelpComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HelpComponent);
    fixture.componentRef.setInput('colorNames', ['Orange', 'Blue']);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('links to the privacy policy in a tab of its own', () => {
    const host = render();

    const link = host.querySelector<HTMLAnchorElement>(
      `a[href="${PRIVACY_POLICY_URL}"]`
    );

    expect(link?.textContent?.trim()).toBe('privacy policy');
    expect(link?.target).toBe('_blank');
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
            buyMeACoffeeHandle: 'wolf',
            androidPackage: 'de.wolsok.bacteriawars',
            playTipProductIds: [],
            ads: { client: 'ca-pub-1', slot: '42' },
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
