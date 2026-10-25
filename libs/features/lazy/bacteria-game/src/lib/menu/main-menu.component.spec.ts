import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { GAME_SUPPORT_OPTIONS } from '../../testing/game-support-options';
import { GameAccount } from '../storage/game-account';
import { provideGameToggles } from '../../testing/fake-game-toggles';
import type { FeatureToggles } from '../state/feature-toggles';
import { ADMIN_PATH } from '../support/legal-links';
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

  it('offers the training until every mission is done', () => {
    const training = jest.fn();
    fixture.componentInstance.training.subscribe(training);
    fixture.componentRef.setInput('missionsDone', 2);
    fixture.detectChanges();

    // Not the New game button, whose line names the training as well.
    expect(button('New here?').textContent).toContain(
      'New here? 2 of 5 missions done'
    );
    button('New here?').click();
    expect(training).toHaveBeenCalled();

    fixture.componentRef.setInput('missionsDone', 5);
    fixture.detectChanges();
    expect(() => button('New here?')).toThrow();
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

  it('badges My Colony while the DNA buys a skin', () => {
    const tile = () => button('My Colony');
    expect(tile().querySelector('.count')).toBeNull();

    fixture.componentRef.setInput('colonyDna', 12);
    fixture.detectChanges();

    expect(tile().classList).toContain('ready');
    expect(tile().querySelector('.count')?.textContent?.trim()).toBe('12');
    expect(
      tile().querySelector('.cdk-visually-hidden')?.textContent?.trim()
    ).toBe('12 DNA - a new skin is within reach');
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

  it('shows the leaderboards only with the cloud, while the toggle is on', () => {
    const toggles = new BehaviorSubject<Partial<FeatureToggles>>({});
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideGameToggles(toggles)],
    });
    const menu = TestBed.createComponent(MainMenuComponent);
    menu.componentRef.setInput('campaign', CAMPAIGN);
    menu.detectChanges();
    const tile = () =>
      Array.from(
        (menu.nativeElement as HTMLElement).querySelectorAll('.tiles button')
      ).find((b) => b.textContent?.includes('Leaderboards')) as
        | HTMLButtonElement
        | undefined;
    expect(tile()).toBeUndefined();

    menu.componentRef.setInput('friendsAvailable', true);
    menu.detectChanges();
    const open = jest.fn();
    menu.componentInstance.open.subscribe(open);
    tile()?.click();
    expect(open).toHaveBeenCalledWith('leaderboards');

    toggles.next({ leaderboards: false });
    menu.detectChanges();
    expect(tile()).toBeUndefined();
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

describe('MainMenuComponent admin tile', () => {
  function render(options: { onSite: boolean; account?: FakeGameAccount }): {
    host: HTMLElement;
    fixture: ComponentFixture<MainMenuComponent>;
  } {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...(options.onSite
          ? [{ provide: GAME_SUPPORT, useValue: GAME_SUPPORT_OPTIONS }]
          : []),
        ...(options.account === undefined
          ? []
          : [{ provide: GameAccount, useValue: options.account }]),
      ],
    });
    const fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    fixture.detectChanges();
    return { host: fixture.nativeElement, fixture };
  }

  const tile = (host: HTMLElement) =>
    host.querySelector<HTMLAnchorElement>('a.tile.admin');

  function owner(): FakeGameAccount {
    const account = new FakeGameAccount('wolf');
    account.owner.set(true);
    return account;
  }

  it('is not there for a game without a project', () => {
    expect(tile(render({ onSite: true }).host)).toBeNull();
  });

  it('is not there for a guest or a player who is not the owner', () => {
    const account = new FakeGameAccount('ada');
    const { host, fixture } = render({ onSite: true, account });
    expect(tile(host)).toBeNull();

    // Signed in with Google, without the claim.
    account.profile.set({ guest: false, name: 'Ada' });
    fixture.detectChanges();
    expect(tile(host)).toBeNull();
  });

  it('is not there inside the shell, which has no admin route', () => {
    expect(tile(render({ onSite: false, account: owner() }).host)).toBeNull();
  });

  it("leads the owner to the admin area on the game's own site", () => {
    const { host } = render({ onSite: true, account: owner() });

    expect(tile(host)?.textContent).toContain('Admin');
    expect(tile(host)?.getAttribute('href')).toBe(`/${ADMIN_PATH}`);
  });

  it('shows once the owner is known, and in German', () => {
    const account = new FakeGameAccount('wolf');
    const { host, fixture } = render({ onSite: true, account });
    expect(tile(host)).toBeNull();

    account.owner.set(true);
    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();

    expect(tile(host)?.textContent).toContain('Verwaltung');
  });
});
