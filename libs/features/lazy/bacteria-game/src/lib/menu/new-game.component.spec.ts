import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getLevel, LEVELS } from '../state/levels';
import { NewGameComponent } from './new-game.component';
import { NewGameEntry } from './play-modes';

describe('NewGameComponent', () => {
  let fixture: ComponentFixture<NewGameComponent>;
  const DAILY = {
    levelId: 'gen:corridor:42:5',
    name: 'Hungry Locks',
    note: '3 of 3 attempts left',
  };

  async function render(
    inputs: Record<string, unknown> = {}
  ): Promise<HTMLElement> {
    fixture = TestBed.createComponent(NewGameComponent);
    fixture.componentRef.setInput('difficulty', 'normal');
    fixture.componentRef.setInput('levelId', LEVELS[0].id);
    fixture.componentRef.setInput('daily', DAILY);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await settle();
    return fixture.nativeElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement;
  }

  /** The button whose text contains this. */
  function button(text: string): HTMLButtonElement {
    const found = Array.from(
      host().querySelectorAll<HTMLButtonElement>('button')
    ).find((b) => b.textContent?.includes(text));
    if (found === undefined) {
      throw new Error(`no button "${text}"`);
    }
    return found;
  }

  function stepLabels(): string[] {
    return Array.from(host().querySelectorAll('.mat-step-label')).map(
      (label) => label.textContent?.trim() ?? ''
    );
  }

  it('opens on the modes, each with where the player stands in it', async () => {
    await render({ campaignNote: '5 of 14 levels open', endlessBest: 4 });

    const modes = Array.from(host().querySelectorAll('.mode')).map(
      (mode) => mode.textContent ?? ''
    );
    expect(modes).toHaveLength(5);
    expect(modes[0]).toContain('5 of 14 levels open');
    expect(modes[1]).toContain('3 of 3 attempts left');
    expect(modes[2]).toContain('best 4');
    expect(stepLabels()).toEqual(['Mode', 'Level', 'Start']);
  });

  it('goes from the campaign to its levels, then to the start', async () => {
    await render({ locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' } });
    const kinds = jest.fn();
    const levels = jest.fn();
    fixture.componentInstance.kindChange.subscribe(kinds);
    fixture.componentInstance.levelChange.subscribe(levels);

    button('Campaign').click();
    await settle();
    // The ladder's locks hold in the campaign, and no generator is offered.
    expect(host().querySelector('feat-lazy-bac-game-level-map')).not.toBeNull();
    expect(host().querySelector('.generator')).toBeNull();
    expect(button('Corridors').disabled).toBe(true);

    button('Petri Dish').click();
    await settle();

    expect(kinds).toHaveBeenCalledWith('campaign');
    expect(levels).toHaveBeenCalledWith(LEVELS[0].id);
    expect(host().querySelector('.details')?.textContent).toContain(
      LEVELS[0].description
    );
    expect(button('Start Petri Dish')).toBeDefined();
  });

  it('opens every level and the generator in free play', async () => {
    await render({ locks: { [LEVELS[1].id]: 'Win Petri Dish to unlock' } });

    button('Free play').click();
    await settle();

    expect(button('Corridors').disabled).toBe(false);
    expect(host().querySelector('.generator')).not.toBeNull();
  });

  it('skips the level choice for the daily level and briefs on it', async () => {
    await render();
    const started = jest.fn();
    fixture.componentInstance.start.subscribe(started);

    button('Daily level').click();
    await settle();

    expect(stepLabels()).toEqual(['Mode', 'Start']);
    expect(host().querySelector('.details')?.textContent).toContain(
      getLevel(DAILY.levelId).description
    );
    button('Start the daily level').click();
    expect(started).toHaveBeenCalledWith('daily');
  });

  it('starts an endless run without a level to brief on', async () => {
    await render({ endlessBest: 4 });
    const started = jest.fn();
    fixture.componentInstance.start.subscribe(started);

    button('Endless run').click();
    await settle();

    expect(host().querySelector('.details')?.textContent).toContain(
      'As deep as you can'
    );
    button('Start the run').click();
    expect(started).toHaveBeenCalledWith('endless');
  });

  it('sets two players up with a series, a head start and the rivalry', async () => {
    await render({
      entry: { kind: 'two-players', step: 'start' } satisfies NewGameEntry,
      colonyNames: ['Orange', 'Blue'],
      rivalry: [14, 9],
    });
    const series = jest.fn();
    const headStart = jest.fn();
    fixture.componentInstance.seriesLengthChange.subscribe(series);
    fixture.componentInstance.headStartChange.subscribe(headStart);

    button('Best of 3').click();
    button('Orange ++').click();

    expect(host().querySelector('.difficulty-picker')).toBeNull();
    expect(host().querySelector('.rivalry')?.textContent).toContain(
      'Orange 14 : 9 Blue'
    );
    expect(series).toHaveBeenCalledWith(3);
    expect(headStart).toHaveBeenCalledWith(-2);
  });

  it('shows the best medallion, what the next one needs, and the rules', async () => {
    await render({
      entry: { kind: 'free', step: 'start' } satisfies NewGameEntry,
      levelId: 'containment',
      medals: { containment: { normal: 'silver' } },
    });

    const details = host().textContent ?? '';
    expect(details).toContain('Silver medallion');
    expect(details).toContain('Gold needs a win within');
    const facts = Array.from(host().querySelectorAll('.fact')).map((fact) =>
      fact.textContent?.trim()
    );
    expect(facts).toEqual(['Agar', 'Antibiotic', 'Ice', 'Heat']);
  });

  it('notes the clock of a timed level', async () => {
    await render({
      entry: { kind: 'free', step: 'start' } satisfies NewGameEntry,
      levelId: 'half-life',
    });

    expect(host().querySelector('.facts')?.textContent).toContain(
      'Timed · 2:30'
    );
  });

  it('steps back, and from the modes back to the menu', async () => {
    await render({
      entry: { kind: 'campaign', step: 'start' } satisfies NewGameEntry,
    });
    const back = jest.fn();
    fixture.componentInstance.back.subscribe(back);

    button('Back').click();
    await settle();
    expect(host().querySelector('feat-lazy-bac-game-level-map')).not.toBeNull();
    button('Back').click();
    await settle();
    expect(host().querySelector('.modes')).not.toBeNull();
    button('Menu').click();

    expect(back).toHaveBeenCalled();
  });
});
