import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LEVELS } from '../state/levels';
import { LevelSelectComponent } from './level-select.component';

describe('LevelSelectComponent', () => {
  let fixture: ComponentFixture<LevelSelectComponent>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(LevelSelectComponent);
    fixture.componentRef.setInput('mode', 'vs-computer');
    fixture.componentRef.setInput('difficulty', 'normal');
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

  it('offers a card per level and marks the chosen one', () => {
    const host = render({ levelId: LEVELS[2].id });

    expect(cards(host)).toHaveLength(LEVELS.length);
    expect(cards(host)[2].getAttribute('aria-current')).toBe('true');
    expect(host.querySelector('.details')?.textContent).toContain(
      LEVELS[2].description
    );
  });

  it('locks the levels the ladder has not opened, with the reason', () => {
    const host = render({
      locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' },
    });

    expect(cards(host)[1].disabled).toBe(true);
    expect(cards(host)[1].textContent).toContain('Win Petri Dish to unlock');
    expect(cards(host)[0].disabled).toBe(false);
  });

  it('shows the best medallion and what the next one needs', () => {
    const host = render({
      medals: { [LEVELS[0].id]: { normal: 'silver', hard: 'gold' } },
    });

    const details = host.querySelector('.details')?.textContent ?? '';
    expect(details).toContain('Silver medallion');
    expect(details).toContain('Gold needs a win within');
    expect(
      cards(host)[0].querySelectorAll('feat-lazy-bac-game-medallion')
    ).toHaveLength(3);
  });

  it('leaves the difficulty and the medallions out between two players', () => {
    const host = render({ mode: 'two-players' });

    expect(host.querySelector('.difficulty-picker')).toBeNull();
    expect(host.querySelector('.free-play')).toBeNull();
    expect(host.querySelector('.best')).toBeNull();
    expect(
      cards(host)[0].querySelector('feat-lazy-bac-game-medallion')
    ).toBeNull();
  });

  it('reports the level picked, Start and the way back', () => {
    render();
    const picked = jest.fn();
    const started = jest.fn();
    const back = jest.fn();
    fixture.componentInstance.levelChange.subscribe(picked);
    fixture.componentInstance.start.subscribe(started);
    fixture.componentInstance.back.subscribe(back);
    const host: HTMLElement = fixture.nativeElement;

    cards(host)[3].click();
    host.querySelector<HTMLButtonElement>('.start')?.click();
    host.querySelector<HTMLButtonElement>('.back')?.click();

    expect(picked).toHaveBeenCalledWith(LEVELS[3].id);
    expect(started).toHaveBeenCalled();
    expect(back).toHaveBeenCalled();
  });
});
