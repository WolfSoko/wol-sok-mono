import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EvolutionService } from '../evolution.service';
import { I18nService } from '../i18n/i18n.service';
import { getLevel, LEVELS } from '../state/levels';
import {
  drawPreviews,
  fakePreviewUrl,
  provideFakePreviews,
} from '../../testing/fake-preview-renderer';
import { NewGameComponent } from './new-game.component';
import { NewGameEntry } from './play-modes';

describe('NewGameComponent', () => {
  let fixture: ComponentFixture<NewGameComponent>;
  const DAILY = {
    levelId: 'gen:corridor:42:5',
    attemptsLeft: 3,
    streak: 0,
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
    await render({
      openLevels: 5,
      endlessBest: 4,
      training: { steer: '2026-10-24' },
    });

    const modes = Array.from(host().querySelectorAll('.mode')).map(
      (mode) => mode.textContent ?? ''
    );
    expect(modes).toHaveLength(7);
    expect(modes[0]).toContain('1 of 5 missions done');
    expect(modes[1]).toContain(`5 of ${LEVELS.length} levels open`);
    expect(modes[2]).toContain('3 of 3 attempts left');
    expect(modes[3]).toContain('best 4');
    expect(stepLabels()).toEqual(['Mode', 'Level', 'Start']);
  });

  it('goes from the training to its missions, then to a briefing', async () => {
    await render({
      training: { steer: '2026-10-24' },
      entry: { kind: 'training', step: 'level' } satisfies NewGameEntry,
    });
    const missions = jest.fn();
    const starts = jest.fn();
    fixture.componentInstance.missionChange.subscribe((id) => {
      missions(id);
      fixture.componentRef.setInput('missionId', id);
    });
    fixture.componentInstance.start.subscribe(starts);

    const rows = Array.from(host().querySelectorAll('.mission')).map(
      (row) => row.textContent ?? ''
    );
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain('Done');
    expect(rows[1]).toContain('Up next');
    expect(host().querySelector('feat-lazy-bac-game-level-map')).toBeNull();

    button('Boost').click();
    await settle();

    expect(missions).toHaveBeenCalledWith('boost');
    const briefing = host().querySelector('.details')?.textContent ?? '';
    expect(briefing).toContain('Mission 3 of 5');
    expect(briefing).toContain('Eat 12 pellets and boost twice');
    expect(briefing).toContain('Space, or the boost pad');
    // The training picks its opponent: no difficulty to choose.
    expect(host().querySelector('.difficulty-picker')).toBeNull();
    expect(host().querySelector('.setup')?.textContent).toContain(
      'A training dummy'
    );

    button('Start Boost').click();
    expect(starts).toHaveBeenCalledWith('training');
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

  it('offers the generator in free play, but no medallion for a rolled level', async () => {
    await render();

    button('Free play').click();
    await settle();
    expect(host().querySelector('.generator')).not.toBeNull();

    fixture.componentRef.setInput('levelId', 'gen:field:77:6');
    button('Next').click();
    await settle();
    expect(host().querySelector('.details-number')?.textContent).toContain(
      'Field · difficulty 6'
    );
    expect(host().querySelector('.best')).toBeNull();
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

  it('opens an online match or joins one, and only the host starts', async () => {
    const lobby = {
      phase: 'idle' as const,
      role: null,
      code: null,
      notice: null,
    };
    await render({
      entry: { kind: 'online', step: 'start' } satisfies NewGameEntry,
      online: lobby,
      onlineAvailable: true,
      colonyNames: ['Orange', 'Blue'],
    });
    const hosted = jest.fn();
    const joined = jest.fn();
    const started = jest.fn();
    fixture.componentInstance.hostOnline.subscribe(hosted);
    fixture.componentInstance.joinOnline.subscribe(joined);
    fixture.componentInstance.start.subscribe(started);

    expect(host().querySelector('.start')).toBeNull();
    // The lobby comes first, with no level to pick or brief yet.
    expect(host().querySelector('feat-lazy-bac-game-level-map')).toBeNull();
    expect(host().querySelector('.details')).toBeNull();
    const levels = jest.fn();
    fixture.componentInstance.levelChange.subscribe(levels);
    button('Open a match').click();
    await settle();
    // Opening a match picks its level first; back is back to the lobby.
    expect(host().querySelector('feat-lazy-bac-game-level-map')).not.toBeNull();
    expect(hosted).not.toHaveBeenCalled();
    button('Back').click();
    await settle();
    expect(host().querySelector('feat-lazy-bac-game-level-map')).toBeNull();
    button('Open a match').click();
    await settle();
    const level = host().querySelector<HTMLButtonElement>(
      'feat-lazy-bac-game-level-map button:not([disabled])'
    );
    if (level === null) {
      throw new Error('no level to pick');
    }
    level.click();
    await settle();
    expect(levels).toHaveBeenCalled();
    expect(hosted).toHaveBeenCalledTimes(1);
    expect(host().querySelector('feat-lazy-bac-game-level-map')).toBeNull();
    const input = host().querySelector<HTMLInputElement>('input[name="code"]');
    if (input === null) {
      throw new Error('no code input');
    }
    input.value = 'k7qpxm';
    input.dispatchEvent(new Event('input'));
    button('Join').click();
    expect(hosted).toHaveBeenCalled();
    expect(joined).toHaveBeenCalledWith('k7qpxm');

    fixture.componentRef.setInput('online', {
      ...lobby,
      phase: 'connected',
      role: 'guest',
    });
    await settle();
    expect(host().textContent).toContain('you play Blue');
    expect(host().querySelector('.start')).toBeNull();

    fixture.componentRef.setInput('online', {
      ...lobby,
      phase: 'connected',
      role: 'host',
    });
    await settle();
    button('Start').click();
    expect(started).toHaveBeenCalledWith('online');
  });

  it('opens a match on the level chosen when the player goes on with Next', async () => {
    await render({
      entry: { kind: 'online', step: 'start' } satisfies NewGameEntry,
      online: { phase: 'idle', role: null, code: null, notice: null },
      onlineAvailable: true,
      colonyNames: ['Orange', 'Blue'],
    });
    const hosted = jest.fn();
    fixture.componentInstance.hostOnline.subscribe(hosted);
    button('Open a match').click();
    await settle();
    button('Next').click();
    await settle();
    expect(hosted).toHaveBeenCalledTimes(1);
    expect(host().querySelector('feat-lazy-bac-game-level-map')).toBeNull();
  });

  it('waits with Start until the storage told what the player evolved', async () => {
    const settled = signal(false);
    TestBed.configureTestingModule({
      providers: [{ provide: EvolutionService, useValue: { settled } }],
    });
    await render({
      entry: { kind: 'campaign', step: 'start' } satisfies NewGameEntry,
    });

    const start = host().querySelector<HTMLButtonElement>('.start');
    expect(start?.disabled).toBe(true);

    settled.set(true);
    await settle();

    expect(start?.disabled).toBe(false);
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

  it('notes the daily streak, and that the attempts are used', async () => {
    await render({ daily: { ...DAILY, attemptsLeft: 0, streak: 4 } });

    expect(host().querySelectorAll('.mode')[2].textContent).toContain(
      'Attempts used - practice until 00:00 UTC · 4-day streak'
    );
  });

  it('speaks German', async () => {
    TestBed.inject(I18nService).setLanguage('de');
    await render({
      entry: { kind: 'two-players', step: 'start' } satisfies NewGameEntry,
      colonyNames: ['Orange', 'Blue'],
      rivalry: [14, 9],
    });

    expect(stepLabels()).toEqual(['Modus', 'Level', 'Start']);
    expect(host().querySelector('.rivalry')?.textContent).toContain(
      'Orange 14 : 9 Blau'
    );
    expect(button('Blau ++')).toBeDefined();
    expect(button('Zurück')).toBeDefined();
  });

  it('briefs without a picture where previews are not drawn', async () => {
    await render({ entry: { kind: 'free', step: 'start' } });

    expect(host().querySelector('.details')).not.toBeNull();
    expect(host().querySelector('.details-preview')).toBeNull();
  });

  it('shows the map of the level it briefs on', async () => {
    TestBed.configureTestingModule({ providers: [provideFakePreviews()] });
    await render({
      entry: { kind: 'free', step: 'start' },
      levelId: 'expanse',
    });
    await drawPreviews();
    await settle();

    const preview = host().querySelector('.details .details-preview');
    expect(preview?.querySelector('img')?.getAttribute('src')).toBe(
      fakePreviewUrl('expanse')
    );
    expect(preview?.querySelector('img')?.getAttribute('alt')).toBe(
      `Map of ${host().querySelector('.details-title')?.textContent?.trim()}`
    );
    expect(preview?.querySelector('.size')?.textContent).toBe('2× map');
  });
});
