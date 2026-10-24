import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { GAME_SUPPORT_OPTIONS } from '../../testing/game-support-options';
import { GAME_SUPPORT } from '../support/game-support';
import { GameSupport } from '../support/game-support.service';
import { SupportDialogComponent } from '../support/support-dialog.component';
import { I18nService } from '../i18n/i18n.service';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { CampaignSummary, continueText } from '../state/campaign';
import { LEVELS } from '../state/levels';
import { MainMenuComponent } from './main-menu.component';

const CAMPAIGN: CampaignSummary = {
  openLevels: 5,
  medals: { bronze: 2, silver: 4, gold: 3, platinum: 0 },
  achievements: 5,
  xp: 1000,
  continueLabel: '5 · Pillar Field · Normal',
};

describe('MainMenuComponent', () => {
  let fixture: ComponentFixture<MainMenuComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  function button(text: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text)
    );
    if (found == null) {
      throw new Error(`no button "${text}"`);
    }
    return found;
  }

  it('opens My Colony', () => {
    const opened: string[] = [];
    fixture.componentInstance.open.subscribe((page) => opened.push(page));

    button('My Colony').click();

    expect(opened).toEqual(['colony']);
  });

  it('shows the campaign so far', () => {
    const card = host.querySelector('.card')?.textContent ?? '';
    expect(card).toContain(`5 of ${LEVELS.length} levels open`);
    // A medallion per level and difficulty.
    expect(card).toContain(`9 of ${LEVELS.length * BOT_DIFFICULTIES.length}`);
    expect(card).toContain('5 · Pillar Field · Normal');
  });

  it('reports what the player picks', () => {
    const newGame = jest.fn();
    const open = jest.fn();
    const resume = jest.fn();
    fixture.componentInstance.newGame.subscribe(newGame);
    fixture.componentInstance.open.subscribe(open);
    fixture.componentInstance.continueCampaign.subscribe(resume);

    button('New game').click();
    button('Profile').click();
    button('Settings').click();
    button('How to play').click();
    button('Continue the campaign').click();

    expect(newGame).toHaveBeenCalledTimes(1);
    expect(open.mock.calls).toEqual([['profile'], ['settings'], ['help']]);
    expect(resume).toHaveBeenCalled();
  });

  it('mutes, unmutes and toggles fullscreen', () => {
    const sound = jest.fn();
    const fullscreen = jest.fn();
    fixture.componentInstance.soundChange.subscribe(sound);
    fixture.componentInstance.fullscreenChange.subscribe(fullscreen);

    host.querySelector<HTMLButtonElement>('[aria-label="Mute"]')?.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Fullscreen"]')?.click();
    fixture.componentRef.setInput('fullscreen', true);
    fixture.detectChanges();
    host
      .querySelector<HTMLButtonElement>('[aria-label="Exit fullscreen"]')
      ?.click();

    expect(sound).toHaveBeenCalledWith(false);
    expect(fullscreen.mock.calls).toEqual([[true], [false]]);
  });

  it('opens Evolution, with a badge while the DNA buys something', () => {
    const tile = () => button('Evolution');
    expect(tile().querySelector('.count')).toBeNull();
    expect(tile().classList).not.toContain('ready');

    fixture.componentRef.setInput('evolveDna', 7);
    fixture.detectChanges();

    expect(tile().classList).toContain('ready');
    expect(tile().querySelector('.count')?.textContent?.trim()).toBe('7');
    expect(
      tile().querySelector('.cdk-visually-hidden')?.textContent?.trim()
    ).toBe('7 DNA to spend');
    const open = jest.fn();
    fixture.componentInstance.open.subscribe(open);
    tile().click();
    expect(open).toHaveBeenCalledWith('evolution');
  });

  it('shows the friends only with the cloud, with the requests waiting', () => {
    const tile = () =>
      Array.from(host.querySelectorAll('.tiles button')).find((b) =>
        b.textContent?.includes('Friends')
      );
    expect(tile()).toBeUndefined();

    fixture.componentRef.setInput('friendsAvailable', true);
    fixture.detectChanges();
    expect(tile()?.querySelector('.count')).toBeNull();

    fixture.componentRef.setInput('friendRequests', 2);
    fixture.detectChanges();
    expect(tile()?.querySelector('.count')?.textContent?.trim()).toBe('2');
    expect(
      tile()?.querySelector('.cdk-visually-hidden')?.textContent?.trim()
    ).toBe('2 friend requests');
    // What a screen reader names the button: the hidden parts left out.
    const named = tile()?.cloneNode(true) as HTMLElement;
    named.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    expect(named.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Friends 2 friend requests'
    );

    const open = jest.fn();
    fixture.componentInstance.open.subscribe(open);
    button('Friends').click();
    expect(open).toHaveBeenCalledWith('friends');
  });

  it('speaks German, the campaign line included', () => {
    TestBed.inject(I18nService).setLanguage('de');
    fixture.componentRef.setInput('campaign', {
      ...CAMPAIGN,
      continueText: continueText('pillar-field', 'normal'),
    });
    fixture.detectChanges();

    expect(button('Neues Spiel')).toBeDefined();
    expect(host.querySelector('[aria-label="Vollbild"]')).not.toBeNull();
    expect(host.querySelector('.continue-level')?.textContent?.trim()).toBe(
      '5 · Säulenfeld · Normal'
    );
  });

  it('offers no support where the game does not ask for it', () => {
    expect(host.textContent).not.toContain('Support');
    // Inside the shell: neither the legal lines nor the offer to install.
    expect(host.querySelector('footer')).toBeNull();
    expect(host.querySelector('feat-lazy-bac-game-install-banner')).toBeNull();
  });
});

describe('MainMenuComponent support tile', () => {
  function render(where: 'web' | 'app'): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        // The footer's links are routes of the game's own site.
        provideRouter([]),
        {
          provide: GAME_SUPPORT,
          useValue: {
            ...GAME_SUPPORT_OPTIONS,
            playTipProductIds: ['tip_small'],
          },
        },
      ],
    });
    const support = TestBed.inject(GameSupport);
    jest
      .spyOn(support, 'url')
      .mockReturnValue(
        where === 'web' ? 'https://buymeacoffee.com/wolf' : null
      );
    jest
      .spyOn(support, 'tipProducts')
      .mockReturnValue(
        where === 'app'
          ? [{ id: 'tip_small', title: 'Coffee', price: '€1.99' }]
          : []
      );
    const fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('links to the Buy Me a Coffee page on the web, in a tab of its own', () => {
    const link = render('web').querySelector<HTMLAnchorElement>('a.tile');

    expect(link?.textContent).toContain('Support');
    expect(link?.href).toBe('https://buymeacoffee.com/wolf');
    expect(link?.target).toBe('_blank');
  });

  it("ends in the legal lines on the game's own site", () => {
    const footer = render('web').querySelector('footer');

    expect(footer?.textContent).toContain('Privacy policy');
    expect(footer?.textContent).toContain('Legal notice');
  });

  it('asks for support in German too', () => {
    const host = render('web');
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(host.querySelector('a.tile')?.textContent).toContain('Unterstützen');
  });

  it('opens the Play tips in the app', () => {
    const host = render('app');
    const open = jest.spyOn(TestBed.inject(MatDialog), 'open');
    const tile = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button.tile')
    ).find((b) => b.textContent?.includes('Support'));

    tile?.click();

    expect(host.querySelector('a.tile')).toBeNull();
    expect(open).toHaveBeenCalledWith(
      SupportDialogComponent,
      expect.anything()
    );
  });
});
