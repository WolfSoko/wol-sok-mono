import { TestBed } from '@angular/core/testing';
import { ACHIEVEMENT_IDS } from '@wolsok/feat-shared-bacteria-engine';
import {
  ACHIEVEMENT_ICON_IDS,
  achievementIconDataUrl,
} from '@wolsok/feat-shared-bacteria-art';
import { AchievementIconComponent } from './achievement-icon.component';

describe('AchievementIconComponent', () => {
  function render(id: string, earned: boolean) {
    const fixture = TestBed.createComponent(AchievementIconComponent);
    fixture.componentRef.setInput('id', id);
    fixture.componentRef.setInput('earned', earned);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => jest.restoreAllMocks());

  it('has an icon for every achievement of the game, and no other', () => {
    expect([...ACHIEVEMENT_ICON_IDS].sort()).toEqual(
      [...ACHIEVEMENT_IDS].sort()
    );
  });

  it('shows the Play Games icon as it is, past the URL sanitizer', () => {
    const warn = jest.spyOn(console, 'warn');

    const host = render('blitz', true);

    const img = host.querySelector('img');
    expect(img?.getAttribute('src')).toBe(achievementIconDataUrl('blitz'));
    expect(img?.getAttribute('src')).not.toContain('unsafe:');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is decorative: the name beside it says what it is', () => {
    const host = render('blitz', true);

    expect(host.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('shows an earned icon in colour, without a lock', () => {
    const host = render('siege', true);

    expect(host.classList.contains('locked')).toBe(false);
    expect(host.querySelector('.lock')).toBeNull();
  });

  it('greys a locked icon out and puts a lock on it', () => {
    const host = render('siege', false);

    expect(host.classList.contains('locked')).toBe(true);
    expect(host.querySelector('.lock')?.textContent?.trim()).toBe('lock');
    expect(host.querySelector('img')?.getAttribute('src')).toBe(
      achievementIconDataUrl('siege')
    );
  });
});
