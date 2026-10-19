import { TestBed } from '@angular/core/testing';
import { LEVELS } from '../state/levels';
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

  it('lists every achievement, earned ones with their day', () => {
    const host = render({}, { achievements: { blitz: '2026-10-19' } });

    const items = Array.from(host.querySelectorAll('.achievements li'));
    expect(items).toHaveLength(13);
    const blitz = items.find((li) => li.textContent?.includes('Blitz'));
    expect(blitz?.classList.contains('earned')).toBe(true);
    expect(blitz?.textContent).toContain('Earned 19 Oct 2026');
    const siege = items.find((li) => li.textContent?.includes('Siege'));
    expect(siege?.textContent).toContain('5 minutes or more');
    expect(host.querySelector('.achievements h3')?.textContent).toContain(
      '1 of 13'
    );
  });

  it('shows the rank and the way to the next', () => {
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
});
