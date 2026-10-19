import { TestBed } from '@angular/core/testing';
import { LEVELS } from '../state/levels';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  function render(medals: object = {}): HTMLElement {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.componentRef.setInput('medals', medals);
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
});
