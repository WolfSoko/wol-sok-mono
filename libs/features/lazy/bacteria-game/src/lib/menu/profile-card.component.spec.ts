import { TestBed } from '@angular/core/testing';
import { defaultProfile } from '@wolsok/feat-shared-bacteria-engine';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { provideFakeGameCloud } from '../../testing/fake-game-cloud';
import { FakeGameSocial } from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { GameAccount } from '../storage/game-account';
import { ProfileCardComponent } from './profile-card.component';

describe('ProfileCardComponent', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(ProfileCardComponent);
    fixture.componentRef.setInput('xp', 1000);
    fixture.componentRef.setInput('tally', {
      earned: 3,
      total: 15,
      percent: 20,
    });
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  describe('with the cloud', () => {
    let social: FakeGameSocial;

    beforeEach(() => {
      social = new FakeGameSocial();
      TestBed.configureTestingModule({
        providers: [
          { provide: GameAccount, useValue: new FakeGameAccount('ada') },
          provideFakeGameCloud({ social }),
        ],
      });
    });

    it('shows the saved name, motto and picture with the rank emblem', async () => {
      social.put('profiles/ada', {
        ...defaultProfile('ada'),
        name: 'Ada',
        motto: 'Divide and conquer',
      });
      const { host } = await render();

      expect(host.querySelector('.name')?.textContent).toContain('Ada');
      expect(host.querySelector('.motto')?.textContent).toContain(
        'Divide and conquer'
      );
      expect(
        host.querySelector('.emblem feat-lazy-bac-game-avatar')
      ).not.toBeNull();
      expect(
        host
          .querySelector('.emblem feat-lazy-bac-game-rank-badge')
          ?.getAttribute('aria-label')
      ).toContain('Bacillus');
    });

    it('leaves the motto out while there is none', async () => {
      social.put('profiles/ada', { ...defaultProfile('ada'), name: 'Ada' });
      const { host } = await render();

      expect(host.querySelector('.motto')).toBeNull();
    });
  });

  describe('without the cloud', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideFakeGameCloud()] });
    });

    it('names the colony and shows the rank emblem alone', async () => {
      const { host } = await render();

      expect(host.querySelector('.name')?.textContent).toContain('Your colony');
      expect(host.querySelector('feat-lazy-bac-game-avatar')).toBeNull();
      expect(
        host.querySelector('.emblem feat-lazy-bac-game-rank-badge')
      ).not.toBeNull();
    });

    it('shows the rank once, with the way to the next', async () => {
      const { host } = await render();

      expect(
        host.querySelectorAll('feat-lazy-bac-game-rank-badge')
      ).toHaveLength(1);
      expect(host.querySelector('.rank-name')?.textContent).toContain(
        'Bacillus'
      );
      expect(host.querySelector('.xp-line')?.textContent).toContain(
        '500 to Spirillum'
      );
    });

    it('counts the achievements and opens them', async () => {
      const { fixture, host } = await render();
      const opened = jest.fn();
      fixture.componentInstance.achievements.subscribe(opened);

      const button = host.querySelector<HTMLButtonElement>('button.trophies');
      expect(button?.textContent).toContain('Achievements');
      expect(button?.textContent).toContain('3 of 15');
      expect(
        button?.querySelector('mat-progress-bar')?.getAttribute('aria-valuenow')
      ).toBe('20');
      button?.click();

      expect(opened).toHaveBeenCalled();
    });

    it('speaks German', async () => {
      TestBed.inject(I18nService).setLanguage('de');
      const { host } = await render();

      expect(host.querySelector('.name')?.textContent).toContain(
        'Deine Kolonie'
      );
      expect(host.querySelector('button.trophies')?.textContent).toContain(
        'Erfolge'
      );
      expect(host.querySelector('button.trophies')?.textContent).toContain(
        '3 von 15'
      );
    });
  });
});
