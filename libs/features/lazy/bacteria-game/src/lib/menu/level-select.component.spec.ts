import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getLevel, LEVELS } from '../state/levels';
import { parseGeneratedId } from '../state/level-generator/generate-level';
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

  it('offers a series, a head start and the rivalry between two players', () => {
    const host = render({
      mode: 'two-players',
      colonyNames: ['Orange', 'Blue'],
      rivalry: [14, 9],
    });
    const series = jest.fn();
    const headStart = jest.fn();
    fixture.componentInstance.seriesLengthChange.subscribe(series);
    fixture.componentInstance.headStartChange.subscribe(headStart);

    Array.from(
      host.querySelectorAll<HTMLButtonElement>('.series-picker button')
    )
      .find((b) => b.textContent?.includes('Best of 3'))
      ?.click();
    Array.from(
      host.querySelectorAll<HTMLButtonElement>('.head-start-picker button')
    )
      .find((b) => b.textContent?.includes('Orange ++'))
      ?.click();

    expect(host.querySelector('.rivalry')?.textContent).toContain(
      'Orange 14 : 9 Blue'
    );
    expect(series).toHaveBeenCalledWith(3);
    expect(headStart).toHaveBeenCalledWith(-2);
  });

  it('groups the ladder in chapters, each with its open levels', () => {
    const host = render({
      locks: { [LEVELS[2].id]: 'Win Corridors to unlock' },
    });

    const chapters = Array.from(host.querySelectorAll('.chapter-head')).map(
      (head) => head.textContent ?? ''
    );
    expect(chapters[0]).toContain('Petri');
    expect(chapters[0]).toContain('2 of 3 open');
    expect(chapters.some((head) => head.includes('Beyond the ladder'))).toBe(
      true
    );
  });

  it('generates a level of the chosen style and difficulty and picks it', () => {
    const host = render();
    const picked = jest.fn();
    fixture.componentInstance.levelChange.subscribe(picked);

    Array.from(host.querySelectorAll<HTMLButtonElement>('.style-picker button'))
      .find((b) => b.textContent?.includes('Cave'))
      ?.click();
    host.querySelector<HTMLButtonElement>('.generate')?.click();

    const id = picked.mock.calls[0][0] as string;
    expect(parseGeneratedId(id)).toEqual(
      expect.objectContaining({ recipe: 'cave', difficulty: 5 })
    );
  });

  it('shows the generated level picked, beyond the ladder', () => {
    const host = render({ levelId: 'gen:field:77:6' });

    expect(host.querySelector('.branches')?.textContent).toContain(
      getLevel('gen:field:77:6').name
    );
    expect(host.querySelector('.details')?.textContent).toContain(
      getLevel('gen:field:77:6').description
    );
  });

  it('leads to the daily level and an endless run against the computer', () => {
    const host = render({
      daily: { name: 'Hungry Locks', note: '3 of 3 attempts left' },
      endlessBest: 4,
    });
    const daily = jest.fn();
    const endless = jest.fn();
    fixture.componentInstance.playDaily.subscribe(daily);
    fixture.componentInstance.playEndless.subscribe(endless);

    const branches = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.branch')
    );
    branches.find((b) => b.textContent?.includes('Hungry Locks'))?.click();
    branches.find((b) => b.textContent?.includes('Best: 4'))?.click();

    expect(daily).toHaveBeenCalled();
    expect(endless).toHaveBeenCalled();
  });

  it('leaves the daily level and the endless run out between two players', () => {
    const host = render({
      mode: 'two-players',
      daily: { name: 'Hungry Locks', note: '3 of 3 attempts left' },
    });

    expect(host.querySelectorAll('.branch')).toHaveLength(0);
    expect(host.querySelector('.generator')).not.toBeNull();
  });
});
