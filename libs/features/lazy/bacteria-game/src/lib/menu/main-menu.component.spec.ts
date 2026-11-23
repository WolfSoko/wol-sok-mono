import { signal } from '@angular/core';
import {
  ComponentFixture,
  DeferBlockBehavior,
  DeferBlockState,
  TestBed,
} from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { GAME_SUPPORT_OPTIONS } from '../../testing/game-support-options';
import { GameAccount } from '../storage/game-account';
import { provideGameToggles } from '../../testing/fake-game-toggles';
import {
  ADMIN_PATH,
  BOT_DIFFICULTIES,
  CampaignSummary,
  continueText,
  LEVELS,
} from '@wolsok/feat-shared-bacteria-engine';
import { type FeatureToggleStates } from '@wolsok/feat-shared-bacteria-engine/cloud';
import { GAME_SUPPORT } from '../support/game-support';
import { GameSupport } from '../support/game-support.service';
import { SupportDialogComponent } from '../support/support-dialog.component';
import { I18nService } from '../i18n/i18n.service';
import { LabPass } from '../guest/lab-pass.service';
import { InstallOffer } from '../support/install-offer.service';
import { MainMenuComponent } from './main-menu.component';
import { BACTERIUM_RENDERER } from './bacterium/bacterium-renderer';

const CAMPAIGN: CampaignSummary = {
  openLevels: 5,
  medals: { bronze: 2, silver: 4, gold: 3, platinum: 0 },
  achievements: 5,
  xp: 1000,
  continueLabel: '5 · Pillar Field · Normal',
};

/** No WebGL in a spec: the CSS cell stands in. */
const NO_WEBGL = { provide: BACTERIUM_RENDERER, useValue: () => null };

/** The bacterium is deferred: it renders once its chunk has loaded. */
async function settle(menu: ComponentFixture<MainMenuComponent>) {
  menu.detectChanges();
  await menu.whenStable();
  menu.detectChanges();
}

/** A part of the bacterium: its button, or its link for a page. */
function partOf(host: HTMLElement, id: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-part="${id}"] .spot`);
}

describe('MainMenuComponent', () => {
  let fixture: ComponentFixture<MainMenuComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [NO_WEBGL] });
    fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    await settle(fixture);
    host = fixture.nativeElement;
  });

  const part = (id: string) => partOf(host, id);

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

  it('reports what the player picks', async () => {
    const newGame = jest.fn();
    const open = jest.fn();
    const resume = jest.fn();
    fixture.componentInstance.newGame.subscribe(newGame);
    fixture.componentInstance.open.subscribe(open);
    fixture.componentInstance.continueCampaign.subscribe(resume);

    // The ways into play wait for the stage's spinner to show.
    button('New game').click();
    expect(newGame).not.toHaveBeenCalled();
    await fixture.whenStable();
    button('Profile').click();
    button('Settings').click();
    button('How to play').click();
    button('Continue the campaign').click();
    await fixture.whenStable();

    expect(newGame).toHaveBeenCalledTimes(1);
    expect(open.mock.calls).toEqual([['profile'], ['settings'], ['help']]);
    expect(resume).toHaveBeenCalled();
  });

  it('offers the training until every mission is done', async () => {
    const training = jest.fn();
    fixture.componentInstance.training.subscribe(training);
    fixture.componentRef.setInput('missionsDone', 2);
    fixture.detectChanges();

    part('training')?.click();
    await fixture.whenStable();
    expect(training).toHaveBeenCalled();

    fixture.componentRef.setInput('missionsDone', 5);
    fixture.detectChanges();
    expect(part('training')).toBeNull();
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

    expect(tile().querySelector('.count')?.textContent?.trim()).toBe('12');
    expect(
      tile().querySelector('.cdk-visually-hidden')?.textContent?.trim()
    ).toBe('12 DNA - a new skin is within reach');
  });

  it('opens Evolution, with a badge while the DNA buys something', () => {
    const tile = () => button('Evolution');
    expect(tile().querySelector('.count')).toBeNull();

    fixture.componentRef.setInput('evolveDna', 7);
    fixture.detectChanges();

    expect(tile().querySelector('.count')?.textContent?.trim()).toBe('7');
    expect(
      tile().querySelector('.cdk-visually-hidden')?.textContent?.trim()
    ).toBe('7 DNA to spend');
    const open = jest.fn();
    fixture.componentInstance.open.subscribe(open);
    tile().click();
    expect(open).toHaveBeenCalledWith('evolution');
  });

  it('reads the DNA in the card until the game binds it', () => {
    const card = host.querySelector('.card feat-lazy-bac-game-dna-counter');
    expect(card?.textContent).toContain('Reading your DNA…');
  });

  describe('DNA counter in the card', () => {
    const counter = () =>
      host.querySelector('.card feat-lazy-bac-game-dna-counter');

    beforeEach(() => {
      fixture.componentRef.setInput('dna', 34);
      fixture.componentRef.setInput('dnaEarned', 120);
      fixture.componentRef.setInput('dnaLoaded', true);
      fixture.detectChanges();
    });

    it('shows the DNA left and the DNA earned in all', () => {
      expect(counter()?.querySelector('.dna-count')?.textContent?.trim()).toBe(
        '34'
      );
      expect(counter()?.textContent).toContain('120 DNA earned in all');
    });

    it('reads the DNA until the evolution is loaded', () => {
      fixture.componentRef.setInput('dnaLoaded', false);
      fixture.detectChanges();

      expect(counter()?.textContent).toContain('Reading your DNA…');
      expect(counter()?.textContent).not.toContain('earned in all');
    });

    it('glows while the Evolution or the My Colony badge shows', () => {
      expect(counter()?.classList).not.toContain('ready');

      fixture.componentRef.setInput('evolveDna', 34);
      fixture.detectChanges();
      expect(counter()?.classList).toContain('ready');

      fixture.componentRef.setInput('evolveDna', 0);
      fixture.componentRef.setInput('colonyDna', 34);
      fixture.detectChanges();
      expect(counter()?.classList).toContain('ready');

      fixture.componentRef.setInput('colonyDna', 0);
      fixture.detectChanges();
      expect(counter()?.classList).not.toContain('ready');
    });

    it('speaks German', () => {
      TestBed.inject(I18nService).setLanguage('de');
      fixture.detectChanges();

      expect(counter()?.textContent).toContain('120 DNA insgesamt verdient');

      fixture.componentRef.setInput('dnaLoaded', false);
      fixture.detectChanges();
      expect(counter()?.textContent).toContain('Deine DNA wird gelesen…');
    });
  });

  it('shows the friends only with the cloud, with the requests waiting', () => {
    const tile = () => part('friends');
    expect(tile()).toBeNull();

    fixture.componentRef.setInput('cloudAvailable', true);
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

  it('shows the leaderboards only with the cloud, while the toggle is on', async () => {
    const toggles = new BehaviorSubject<Partial<FeatureToggleStates>>({});
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideGameToggles(toggles), NO_WEBGL],
    });
    const menu = TestBed.createComponent(MainMenuComponent);
    menu.componentRef.setInput('campaign', CAMPAIGN);
    await settle(menu);
    const tile = () => partOf(menu.nativeElement, 'leaderboards');
    expect(tile()).toBeNull();

    menu.componentRef.setInput('cloudAvailable', true);
    menu.detectChanges();
    const open = jest.fn();
    menu.componentInstance.open.subscribe(open);
    tile()?.click();
    expect(open).toHaveBeenCalledWith('leaderboards');

    toggles.next({ leaderboards: 'off' });
    menu.detectChanges();
    expect(tile()).toBeNull();
  });

  it('shows the bacterium, the utilities as tiles', () => {
    expect(
      host.querySelector('feat-lazy-bac-game-bacterium-menu')
    ).not.toBeNull();
    // The CSS cell, where WebGL cannot draw it.
    expect(host.querySelector('.css-body')).not.toBeNull();
    expect(host.querySelector('.actions')).toBeNull();
    expect(tileNames()).toEqual([
      expect.stringContaining('Settings'),
      expect.stringContaining('How to play'),
    ]);
  });

  it('leads each part where it belongs, online too', async () => {
    fixture.componentRef.setInput('onlineAvailable', true);
    await settle(fixture);
    const component = fixture.componentInstance;
    const newGame = jest.fn();
    const online = jest.fn();
    const training = jest.fn();
    const open = jest.fn();
    component.newGame.subscribe(newGame);
    component.online.subscribe(online);
    component.training.subscribe(training);
    component.open.subscribe(open);

    part('play')?.click();
    await fixture.whenStable();
    part('online')?.click();
    await fixture.whenStable();
    part('training')?.click();
    await fixture.whenStable();
    for (const id of ['colony', 'evolution', 'profile', 'my-matches']) {
      part(id)?.click();
    }

    expect(newGame).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledTimes(1);
    expect(training).toHaveBeenCalledTimes(1);
    expect(open.mock.calls).toEqual([
      ['colony'],
      ['evolution'],
      ['profile'],
      ['my-matches'],
    ]);
  });

  it('offers online only where online matches can be played', async () => {
    expect(part('online')).toBeNull();

    fixture.componentRef.setInput('onlineAvailable', true);
    await settle(fixture);
    expect(part('online')).not.toBeNull();
  });

  const tileNames = () =>
    Array.from(host.querySelectorAll('.tiles .tile')).map(
      (tile) => tile.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );

  const partNames = () =>
    Array.from(host.querySelectorAll('[data-part]')).map(
      (item) => item.getAttribute('data-part') ?? ''
    );

  it('orders its parts: a new game, the ways to play, progress, then players and matches', () => {
    expect(partNames()).toEqual([
      'play',
      'training',
      'colony',
      'evolution',
      'profile',
      'my-matches',
      'gallery',
    ]);
  });

  it('always offers My matches, with or without the cloud', () => {
    const open = jest.fn();
    fixture.componentInstance.open.subscribe(open);

    button('My matches').click();

    expect(open).toHaveBeenCalledWith('my-matches');
  });

  it('links the matches of the day in a tab of its own inside the shell', () => {
    const link = part('gallery') as HTMLAnchorElement | null;

    expect(link?.textContent).toContain('Matches of the day');
    expect(link?.href).toBe('https://bacteria-wars.wolsok.de/replays');
    expect(link?.target).toBe('_blank');

    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();
    expect(link?.textContent).toContain('Matches des Tages');
    expect(link?.href).toBe('https://bacteria-wars.wolsok.de/replays?lang=de');
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

describe('MainMenuComponent without the bacterium chunk', () => {
  it('offers the same items as tiles where the chunk fails to load', async () => {
    TestBed.configureTestingModule({
      providers: [NO_WEBGL],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    const menu = TestBed.createComponent(MainMenuComponent);
    menu.componentRef.setInput('campaign', CAMPAIGN);
    menu.componentRef.setInput('cloudAvailable', true);
    menu.componentRef.setInput('friendRequests', 2);
    menu.detectChanges();
    const [bacterium] = await menu.getDeferBlocks();
    await bacterium.render(DeferBlockState.Error);
    const host: HTMLElement = menu.nativeElement;
    const fallback = host.querySelector('.bacterium .tiles');
    const names = Array.from(fallback?.querySelectorAll('.tile') ?? []).map(
      (tile) => tile.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );

    expect(host.querySelector('feat-lazy-bac-game-bacterium-menu')).toBeNull();
    expect(names).toEqual([
      'play_arrow New game',
      'school Training',
      'bubble_chart My Colony',
      'biotech Evolution',
      'person Profile',
      'group Friends 2 friend requests',
      'leaderboard Leaderboards',
      'smart_display My matches',
      'video_library Matches of the day',
    ]);

    const newGame = jest.fn();
    const open = jest.fn();
    menu.componentInstance.newGame.subscribe(newGame);
    menu.componentInstance.open.subscribe(open);
    const tile = (name: string) =>
      Array.from(
        fallback?.querySelectorAll<HTMLButtonElement>('button.tile') ?? []
      ).find((button) => button.textContent?.includes(name));
    tile('New game')?.click();
    await menu.whenStable();
    tile('My Colony')?.click();

    expect(newGame).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('colony');
    expect(fallback?.querySelector('a.tile')?.getAttribute('href')).toContain(
      '/replays'
    );
  });
});

describe('MainMenuComponent support tile', () => {
  async function render(where: 'web' | 'app'): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        // The footer's links are routes of the game's own site.
        provideRouter([]),
        NO_WEBGL,
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
        where === 'web' ? 'https://buymeacoffee.com/wolfsoko' : null
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
    await settle(fixture);
    return fixture.nativeElement;
  }

  it('links to the Buy Me a Coffee page on the web, in a tab of its own', async () => {
    const link = (await render('web')).querySelector<HTMLAnchorElement>(
      'a.tile.support'
    );

    expect(link?.textContent).toContain('Support');
    expect(link?.href).toBe('https://buymeacoffee.com/wolfsoko');
    expect(link?.target).toBe('_blank');
  });

  it("opens the matches of the day in place on the game's own site", async () => {
    const link = partOf(await render('web'), 'gallery') as HTMLAnchorElement;

    // On whatever origin serves the game: a preview or a dev server too.
    expect(link?.getAttribute('href')).toBe('/replays');
    expect(link?.target).toBe('');
  });

  it("ends in the legal lines on the game's own site", async () => {
    const footer = (await render('web')).querySelector('footer');

    expect(footer?.textContent).toContain('Privacy policy');
    expect(footer?.textContent).toContain('Legal notice');
  });

  it('asks for support in German too', async () => {
    const host = await render('web');
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();

    expect(host.querySelector('a.tile.support')?.textContent).toContain(
      'Unterstützen'
    );
  });

  it('opens the Play tips in the app', async () => {
    const host = await render('app');
    const open = jest.spyOn(TestBed.inject(MatDialog), 'open');
    const tile = Array.from(
      host.querySelectorAll<HTMLButtonElement>('button.tile')
    ).find((b) => b.textContent?.includes('Support'));

    tile?.click();

    expect(host.querySelector('a.tile.support')).toBeNull();
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

describe('MainMenuComponent and the Lab Pass', () => {
  function renderWith(pass: Partial<LabPass>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: LabPass, useValue: pass }],
    });
    const fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    const open = jest.fn();
    fixture.componentInstance.open.subscribe(open);
    return { fixture, open };
  }

  it('gives way to the install offer while the pass is not urgent', () => {
    const urgent = signal(false);
    const offer = {
      visible: signal(true),
      platform: 'other',
      storeUrl: null,
      canInstallWebApp: signal(false),
      dismiss: jest.fn(),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: LabPass,
          useValue: {
            ...quietPass(),
            visible: signal(true),
            urgent,
            steps: signal([]),
            next: signal('sign-in'),
            done: signal(0),
            justEarned: signal(false),
            cameBack: signal(false),
          },
        },
        { provide: InstallOffer, useValue: offer },
      ],
    });
    const fixture = TestBed.createComponent(MainMenuComponent);
    fixture.componentRef.setInput('campaign', CAMPAIGN);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const card = () => host.querySelector('feat-lazy-bac-game-lab-pass-card');

    const install = () =>
      host.querySelector('feat-lazy-bac-game-install-banner');

    expect(install()).not.toBeNull();
    expect(card()).toBeNull();

    offer.visible.set(false);
    fixture.detectChanges();
    expect(install()).toBeNull();
    expect(card()).not.toBeNull();

    offer.visible.set(true);
    urgent.set(true);
    fixture.detectChanges();
    expect(install()).toBeNull();
    expect(card()).not.toBeNull();
  });

  function quietPass() {
    return {
      visible: signal(false),
      onboardingDue: signal(false),
      startOnboarding: jest.fn(),
    };
  }

  it('opens the profile once a sign-in brought no profile', () => {
    const pass = quietPass();
    const { fixture, open } = renderWith(pass);
    fixture.detectChanges();
    expect(open).not.toHaveBeenCalled();

    pass.onboardingDue.set(true);
    pass.startOnboarding.mockImplementation(() =>
      pass.onboardingDue.set(false)
    );
    fixture.detectChanges();

    expect(pass.startOnboarding).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('profile');
  });
});
