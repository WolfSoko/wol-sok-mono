import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getLevel, LEVELS } from '../state/levels';
import { parseGeneratedId } from '../state/level-generator/generate-level';
import { LevelMapComponent } from './level-map.component';

describe('LevelMapComponent', () => {
  let fixture: ComponentFixture<LevelMapComponent>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(LevelMapComponent);
    fixture.componentRef.setInput('levelId', LEVELS[0].id);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function cards(host: HTMLElement): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll('.level-card'));
  }

  it('offers a card per level, marks the chosen one and reports a pick', () => {
    const host = render({ levelId: LEVELS[2].id });
    const picked = jest.fn();
    fixture.componentInstance.pick.subscribe(picked);

    cards(host)[3].click();

    expect(cards(host)).toHaveLength(LEVELS.length);
    expect(cards(host)[2].getAttribute('aria-current')).toBe('true');
    expect(picked).toHaveBeenCalledWith(LEVELS[3].id);
  });

  it('locks the levels the ladder has not opened, with the reason', () => {
    const host = render({
      locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' },
    });

    expect(cards(host)[1].disabled).toBe(true);
    expect(cards(host)[1].textContent).toContain('Win Petri Dish to unlock');
    expect(cards(host)[0].disabled).toBe(false);
  });

  it('shows the medallions per difficulty, unless there are none to earn', () => {
    const medals = { [LEVELS[0].id]: { normal: 'silver' as const } };
    const host = render({ medals });

    expect(
      cards(host)[0].querySelectorAll('feat-lazy-bac-game-medallion')
    ).toHaveLength(3);

    fixture.componentRef.setInput('showMedals', false);
    fixture.detectChanges();
    expect(
      cards(host)[0].querySelector('feat-lazy-bac-game-medallion')
    ).toBeNull();
  });

  it('groups the ladder in chapters, counting the open levels on the ladder', () => {
    const host = render({
      laddered: true,
      locks: { [LEVELS[2].id]: 'Win Corridors to unlock' },
    });

    const chapters = Array.from(host.querySelectorAll('.chapter-head')).map(
      (head) => head.textContent ?? ''
    );
    expect(chapters[0]).toContain('Petri');
    expect(chapters[0]).toContain('2 of 3 open');
  });

  it('counts the open levels only where the ladder locks them', () => {
    const host = render();

    expect(host.querySelector('.chapter-open')).toBeNull();
  });

  it('offers the generator only where the mode allows it', () => {
    expect(render().querySelector('.generator')).toBeNull();
    expect(
      render({ generator: true }).querySelector('.generator')
    ).not.toBeNull();
  });

  it('generates a level of the chosen style and difficulty and picks it', () => {
    const host = render({ generator: true });
    const picked = jest.fn();
    fixture.componentInstance.pick.subscribe(picked);

    Array.from(host.querySelectorAll<HTMLButtonElement>('.style-picker button'))
      .find((b) => b.textContent?.includes('Cave'))
      ?.click();
    host.querySelector<HTMLButtonElement>('.generate')?.click();

    const id = picked.mock.calls[0][0] as string;
    expect(parseGeneratedId(id)).toEqual(
      expect.objectContaining({ recipe: 'cave', difficulty: 5 })
    );
  });

  it('keeps the rolled level offered, and its style, after a ladder pick', () => {
    const host = render({ generator: true, levelId: 'gen:cave:77:8' });

    fixture.componentRef.setInput('levelId', LEVELS[0].id);
    fixture.detectChanges();

    expect(host.querySelector('.branches')?.textContent).toContain(
      getLevel('gen:cave:77:8').name
    );
    expect(host.textContent).toContain('Difficulty 8');
  });
});
