import { signal } from '@angular/core';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { I18nService } from '../i18n/i18n.service';
import {
  MatchLevel,
  MatchmakerService,
  MatchmakingState,
} from '../net/matchmaker.service';
import { IDLE_LOBBY, OnlineLobby } from '../net/online-match.service';
import { GameSettingsService } from '../settings.service';
import { MATCH_LEVELS } from '../state/match-level';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import { LocalGameStorage } from '../storage/local-game-storage';
import { OnlineLobbyComponent } from './online-lobby.component';

describe('OnlineLobbyComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            social: () => null,
            presence: () => null,
            rooms: () => null,
            storage: () => new LocalGameStorage(),
          },
        },
      ],
    });
  });

  function render(
    lobby: Partial<OnlineLobby>,
    colonyNames: readonly [string, string] | null = null
  ): HTMLElement {
    const fixture = TestBed.createComponent(OnlineLobbyComponent);
    fixture.componentRef.setInput('lobby', { ...IDLE_LOBBY, ...lobby });
    fixture.componentRef.setInput('colonyNames', colonyNames);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const text = (host: HTMLElement) =>
    host.textContent?.replace(/\s+/g, ' ').trim();

  it('offers to open a match or join one with a code', () => {
    const host = render({});

    expect(text(host)).toContain('Play with a code');
    expect(text(host)).toContain('Open a match');
  });

  it('names the colony the player steers, and the notice', () => {
    const host = render(
      {
        phase: 'connected',
        role: 'guest',
        notice: { key: 'online.notices.opponentLeft' },
      },
      ['Orange', 'Blue']
    );

    expect(text(host)).toContain('Connected - you play Blue.');
    expect(text(host)).toContain('Your opponent left.');
  });

  it('speaks German', () => {
    // The settings first, which would restore the browser's language.
    TestBed.inject(GameSettingsService);
    TestBed.inject(I18nService).setLanguage('de');
    const host = render(
      {
        phase: 'connected',
        role: 'guest',
        notice: { key: 'online.notices.lost' },
      },
      ['Orange', 'Blue']
    );

    expect(text(host)).toContain('Verbunden – du spielst Blau.');
    expect(text(host)).toContain(
      'Die Verbindung zu deinem Gegner ist abgebrochen.'
    );
    expect(text(host)).toContain('Verlassen');
  });

  describe('the level the matchmaking asks for', () => {
    let matchmaker: {
      available: boolean;
      state: ReturnType<typeof signal<MatchmakingState>>;
      matchLevel: ReturnType<typeof signal<MatchLevel | null>>;
      setLevel: jest.Mock;
      find: jest.Mock;
      cancel: jest.Mock;
    };
    const hourglass = MATCH_LEVELS.find(({ id }) => id === 'hourglass');

    beforeEach(() => {
      localStorage.clear();
      matchmaker = {
        available: true,
        state: signal<MatchmakingState>('idle'),
        matchLevel: signal<MatchLevel | null>(null),
        setLevel: jest.fn(),
        find: jest.fn(),
        cancel: jest.fn(),
      };
      TestBed.configureTestingModule({
        imports: [NoopAnimationsModule],
        providers: [{ provide: MatchmakerService, useValue: matchmaker }],
      });
    });

    /** The level select of an idle lobby. */
    async function levelSelect(): Promise<{
      host: HTMLElement;
      select: MatSelectHarness;
    }> {
      const fixture = TestBed.createComponent(OnlineLobbyComponent);
      fixture.componentRef.setInput('lobby', IDLE_LOBBY);
      const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(
        MatSelectHarness.with({ selector: '.match-level mat-select' })
      );
      return { host: fixture.nativeElement, select };
    }

    it('offers any level first, and asks for any level by default', async () => {
      const { host, select } = await levelSelect();

      expect(host.querySelector('.match-level')?.textContent).toContain(
        'Level'
      );
      expect(await select.getValueText()).toBe('Any level');
      expect(
        host.querySelector('.match-level ~ button.find')?.textContent
      ).toContain('Find an opponent');
      expect(matchmaker.setLevel).toHaveBeenLastCalledWith(null);
    });

    it('lists the levels that play online, and keeps the one picked', async () => {
      const { select } = await levelSelect();
      await select.open();

      const names = await Promise.all(
        (await select.getOptions()).map((option) => option.getText())
      );
      expect(hourglass).toBeDefined();
      expect(names).toHaveLength(MATCH_LEVELS.length + 1);
      expect(names[0]).toBe('Any level');
      // Under the level map's names, without the ladder's numbers.
      expect(names).toContain('Hourglass');
      expect(names.some((name) => /\d/.test(name))).toBe(false);
      await select.clickOptions({ text: 'Hourglass' });

      expect(TestBed.inject(GameSettingsService).matchLevel()).toBe(
        hourglass?.id
      );
      expect(matchmaker.setLevel).toHaveBeenLastCalledWith(hourglass?.id);
    });

    it('says which level the match is on, and whose choice it was', () => {
      matchmaker.state.set('found');
      matchmaker.matchLevel.set({ levelId: 'hourglass', reason: 'yours' });
      const fixture = TestBed.createComponent(OnlineLobbyComponent);
      fixture.componentRef.setInput('lobby', {
        ...IDLE_LOBBY,
        phase: 'connecting',
        role: 'guest',
        auto: true,
      });
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;
      expect(text(host)).toContain('Level: Hourglass (your choice)');

      matchmaker.matchLevel.set({ levelId: 'hourglass', reason: 'theirs' });
      fixture.detectChanges();
      expect(text(host)).toContain("Level: Hourglass (opponent's choice)");

      matchmaker.matchLevel.set({ levelId: 'hourglass', reason: 'random' });
      fixture.detectChanges();
      expect(text(host)).toContain('Level: Hourglass (random)');
    });

    it('says nothing of a level for a match opened with a code', () => {
      matchmaker.matchLevel.set({ levelId: 'hourglass', reason: 'yours' });
      const host = render({ phase: 'connected', role: 'host', auto: false });

      expect(text(host)).not.toContain('Level:');
    });

    it('speaks German', async () => {
      // The settings first, which would restore the browser's language.
      TestBed.inject(GameSettingsService);
      TestBed.inject(I18nService).setLanguage('de');
      matchmaker.matchLevel.set({ levelId: 'hourglass', reason: 'theirs' });

      const { select } = await levelSelect();
      expect(await select.getValueText()).toBe('Beliebiges Level');

      const matched = render({
        phase: 'connected',
        role: 'guest',
        auto: true,
      });
      expect(text(matched)).toContain('Level: Sanduhr (Wahl deines Gegners)');
    });
  });
});
