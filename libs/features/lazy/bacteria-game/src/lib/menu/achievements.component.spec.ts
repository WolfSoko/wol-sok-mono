import { TestBed } from '@angular/core/testing';
import { achievementIconDataUrl } from '@wolsok/feat-shared-bacteria-art';
import { ACHIEVEMENT_IDS } from '@wolsok/feat-shared-bacteria-engine';
import { I18nService } from '../i18n/i18n.service';
import { AchievementsComponent } from './achievements.component';

describe('AchievementsComponent', () => {
  function render(achievements: object = {}) {
    const fixture = TestBed.createComponent(AchievementsComponent);
    fixture.componentRef.setInput('achievements', achievements);
    fixture.componentRef.setInput('backLabel', 'Profile');
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  function item(host: HTMLElement, name: string): Element | undefined {
    return Array.from(host.querySelectorAll('.achievements li')).find((li) =>
      li.textContent?.includes(name)
    );
  }

  it('lists every achievement, earned ones with their day', () => {
    const { host } = render({ blitz: '2026-10-19' });

    expect(host.querySelectorAll('.achievements li')).toHaveLength(
      ACHIEVEMENT_IDS.length
    );
    const blitz = item(host, 'Blitz');
    expect(blitz?.classList.contains('earned')).toBe(true);
    expect(blitz?.textContent).toContain('Earned 19 Oct 2026');
    const siege = item(host, 'Siege');
    expect(siege?.classList.contains('earned')).toBe(false);
    expect(siege?.textContent).toContain('5 minutes or more');
  });

  it('shows each achievement with its Play Games icon, locked ones greyed', () => {
    const { host } = render({ blitz: '2026-10-19' });

    const icon = (name: string) =>
      item(host, name)?.querySelector('feat-lazy-bac-game-achievement-icon');
    expect(icon('Blitz')?.querySelector('img')?.getAttribute('src')).toBe(
      achievementIconDataUrl('blitz')
    );
    expect(icon('Blitz')?.classList.contains('locked')).toBe(false);
    expect(icon('Siege')?.querySelector('img')?.getAttribute('src')).toBe(
      achievementIconDataUrl('siege')
    );
    expect(icon('Siege')?.classList.contains('locked')).toBe(true);
  });

  it('counts the achievements earned', () => {
    const { host } = render({ blitz: '2026-10-19' });

    expect(host.querySelector('.count')?.textContent).toContain(
      `1 of ${ACHIEVEMENT_IDS.length}`
    );
    expect(
      host.querySelector('mat-progress-bar')?.getAttribute('aria-valuenow')
    ).toBe(String(Math.round(100 / ACHIEVEMENT_IDS.length)));
  });

  it('lists the Lab Pass reward among them', () => {
    const { host } = render({ 'lab-member': '2026-11-20' });

    const lab = item(host, 'Lab Member');
    expect(lab?.classList.contains('earned')).toBe(true);
    expect(lab?.textContent).toContain('Earned 20 Nov 2026');
  });

  it('leads back where its label says', () => {
    const { fixture, host } = render();
    const back = jest.fn();
    fixture.componentInstance.back.subscribe(back);

    const button = host.querySelector<HTMLButtonElement>('button.back');
    expect(button?.textContent).toContain('Profile');
    button?.click();

    expect(back).toHaveBeenCalled();
  });

  it('speaks German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const { host } = render({ blitz: '2026-10-19' });

    expect(host.querySelector('h2')?.textContent).toContain('Erfolge');
    expect(item(host, 'Blitz')?.textContent).toContain(
      'Freigeschaltet am 19. Okt. 2026'
    );
    expect(item(host, 'Labormitglied')?.textContent).toContain(
      'Fülle deinen Laborausweis aus'
    );
  });
});
