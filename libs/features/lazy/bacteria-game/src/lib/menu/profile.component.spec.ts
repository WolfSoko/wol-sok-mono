import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { GameAccount } from '../storage/game-account';
import { ACHIEVEMENT_IDS, LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  function render(
    medals: object = {},
    inputs: Record<string, unknown> = {}
  ): HTMLElement {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.componentRef.setInput('medals', medals);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('counts the levels won and the medallions per metal', () => {
    const host = render({
      [LEVELS[0].id]: { easy: 'gold', normal: 'gold' },
      [LEVELS[1].id]: { hard: 'bronze' },
    });

    const figures = host.querySelector('.figures')?.textContent ?? '';
    expect(figures).toContain(`2 of ${LEVELS.length}`);
    expect(figures).toContain(`3 of ${LEVELS.length * 3}`);
    const tally = Array.from(host.querySelectorAll('.tally li')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(tally).toEqual(['0 Platinum', '2 Gold', '0 Silver', '1 Bronze']);
  });

  it('lists every level with a slot per difficulty', () => {
    const host = render();

    expect(host.querySelectorAll('tbody tr')).toHaveLength(LEVELS.length);
    expect(
      host.querySelectorAll('tbody feat-lazy-bac-game-medallion')
    ).toHaveLength(LEVELS.length * 3);
  });

  it('shows the lifetime numbers', () => {
    const host = render(
      {},
      {
        totals: {
          matches: 42,
          wins: 27,
          captured: 18430,
          enemyCrushed: 212,
          couchMatches: 7,
          matchXp: 0,
        },
      }
    );

    const figures = host.querySelector('.figures')?.textContent ?? '';
    expect(figures).toContain('27 of 42');
    expect(figures).toContain('18,430');
    expect(figures).toContain('212');
  });

  it('opens with the player card, which leads to the achievements', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.componentRef.setInput('achievements', {
      blitz: '2026-10-19',
      'lab-member': '2026-11-20',
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const opened = jest.fn();
    fixture.componentInstance.openAchievements.subscribe(opened);

    const body = host.querySelector('.body');
    expect(body?.firstElementChild?.tagName.toLowerCase()).toBe(
      'feat-lazy-bac-game-profile-card'
    );
    const trophies = host.querySelector<HTMLButtonElement>('button.trophies');
    expect(trophies?.textContent).toContain(`2 of ${ACHIEVEMENT_IDS.length}`);
    trophies?.click();
    expect(opened).toHaveBeenCalled();
  });

  it("shows the achievements only as the card's count", () => {
    const host = render({}, { achievements: { blitz: '2026-10-19' } });

    expect(host.querySelector('.achievements')).toBeNull();
    expect(host.textContent).not.toContain('Earned 19 Oct 2026');
    expect(host.querySelector('button.trophies')?.textContent).toContain(
      `1 of ${ACHIEVEMENT_IDS.length}`
    );
  });

  it('shows the colony and no online profile without the cloud', () => {
    const host = render();

    expect(host.querySelector('.card .name')?.textContent).toContain(
      'Your colony'
    );
    expect(host.querySelector('feat-lazy-bac-game-profile-editor')).toBeNull();
  });

  it('shows all the DNA the XP has grown', () => {
    const host = render({}, { xp: 1275 });

    expect(host.querySelector('.figures')?.textContent).toContain(
      'DNA earned25'
    );
  });

  it('shows the rank on the card and on the ladder', () => {
    const host = render(
      {},
      {
        xp: 1000,
      }
    );

    expect(host.querySelector('.rank-name')?.textContent).toContain('Bacillus');
    expect(host.querySelector('.xp-line')?.textContent).toContain(
      '500 to Spirillum'
    );
    expect(host.querySelector('.ranks .current')?.textContent?.trim()).toBe(
      'Bacillus'
    );
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const host = render(
      { [LEVELS[0].id]: { easy: 'gold' } },
      {
        achievements: { blitz: '2026-10-19' },
        totals: {
          matches: 42,
          wins: 27,
          captured: 18430,
          enemyCrushed: 212,
          couchMatches: 7,
          matchXp: 0,
        },
      }
    );

    const figures = host.querySelector('.figures')?.textContent ?? '';
    expect(figures).toContain('Level gewonnen');
    expect(figures).toContain('27 von 42');
    expect(figures).toContain('18.430');
    expect(host.querySelector('button.trophies')?.textContent).toContain(
      `1 von ${ACHIEVEMENT_IDS.length}`
    );
    expect(host.querySelector('thead')?.textContent).toContain('Leicht');
  });

  describe('with the cloud', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          { provide: GameAccount, useValue: new FakeGameAccount('ada') },
          provideFakeGameCloud({
            social: new FakeGameSocial(),
            presence: new FakeGamePresence(),
          }),
        ],
      });
    });

    it('keeps the online profile with every privacy setting below the card', async () => {
      const fixture = TestBed.createComponent(ProfileComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement;

      const card = host.querySelector('feat-lazy-bac-game-profile-card');
      const editor = host.querySelector('feat-lazy-bac-game-profile-editor');
      expect(card?.nextElementSibling?.contains(editor)).toBe(true);
      const toggles = Array.from(host.querySelectorAll('mat-slide-toggle')).map(
        (toggle) => toggle.textContent?.trim()
      );
      expect(toggles).toEqual([
        "Friends see when I'm online",
        'Show my name in public',
        'Keep me off the leaderboards',
        'Keep my matches out of the public gallery',
      ]);
    });
  });
});
