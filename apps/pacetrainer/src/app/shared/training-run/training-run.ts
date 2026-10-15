import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
  Signal,
} from '@angular/core';
import {
  add,
  milliseconds,
  Milliseconds,
  subtract,
  ZERO_MS,
} from '../model/constants/time-utils';
import { ExerciseType } from '../model/training/excercise';
import { RepositoryFactory } from '../repository/repository.factory';
import { TrainingConfigWithDuration } from '../model/training/training-config-with.duration';
import { TrainingName } from '../model/training/training-name';

export type RunPhase = 'ready' | 'leadIn' | 'running' | 'paused' | 'finished';

export interface IntervalView {
  name: TrainingName;
  index: number;
  count: number;
  duration: Milliseconds;
  left: Milliseconds;
  elapsed: Milliseconds;
}

export interface Zusammenfassung {
  elapsed: Milliseconds;
  sprintsCompleted: number;
  sprintsTotal: number;
  completion: 'complete' | 'endedEarly';
}

export type TrainingRunView =
  | { phase: 'ready' }
  | { phase: 'leadIn'; left: Milliseconds; total: Milliseconds }
  | {
      phase: 'running' | 'paused';
      current: IntervalView;
      next: TrainingName | 'finished';
      elapsed: Milliseconds;
    }
  | { phase: 'finished'; zusammenfassung: Zusammenfassung };

const LEAD_IN = milliseconds(5000);
const TICK_PERIOD = 50;
const SAVE_EVERY = 1000;

interface PlannedIntervall {
  type: ExerciseType;
  start: Milliseconds;
  duration: Milliseconds;
}

type Run =
  | { phase: 'ready' }
  | {
      phase: 'leadIn' | 'running' | 'paused';
      config: TrainingConfigWithDuration;
      intervalle: PlannedIntervall[];
      elapsed: Milliseconds;
    }
  | { phase: 'finished'; zusammenfassung: Zusammenfassung };

/** what survives a reload: enough to rebuild the run, nothing derived */
interface StoredRun {
  config: TrainingConfigWithDuration;
  elapsed: Milliseconds;
}

/**
 * Führt einen Trainingslauf vom Start bis zum Ende durch.
 *
 * Every transition happens synchronously inside a command or a clock tick;
 * illegal commands are ignored.
 */
@Injectable({ providedIn: 'root' })
export class TrainingRun {
  private readonly repository = inject(RepositoryFactory).create<StoredRun>(
    'trainingRun',
    true
  );
  private readonly run = signal<Run>(this.restore());
  private clock: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private lastSavedSecond = -1;

  public readonly state: Signal<TrainingRunView> = computed(() =>
    project(this.run())
  );
  public readonly phase: Signal<RunPhase> = computed(() => this.run().phase);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopClock());
  }

  public start(config: TrainingConfigWithDuration): void {
    const intervalle = toIntervalle(config);
    if (this.run().phase !== 'ready' || intervalle.length === 0) {
      return;
    }
    this.update({ phase: 'leadIn', config, intervalle, elapsed: ZERO_MS });
    this.startClock();
  }

  public toggle(): void {
    const run = this.run();
    if (run.phase === 'running') {
      this.stopClock();
      this.update({ ...run, phase: 'paused' });
    } else if (run.phase === 'paused') {
      this.update({ ...run, phase: 'running' });
      this.startClock();
    }
  }

  public end(): void {
    const run = this.run();
    if (run.phase === 'leadIn') {
      this.stopClock();
      this.update({ phase: 'ready' });
    } else if (run.phase === 'running' || run.phase === 'paused') {
      this.finish(run.intervalle, run.elapsed, 'endedEarly');
    }
  }

  public reset(): void {
    if (this.run().phase === 'finished') {
      this.update({ phase: 'ready' });
    }
  }

  private update(run: Run): void {
    const previous = this.run().phase;
    this.run.set(run);
    if (run.phase === 'running') {
      // a reload restores to about the second; every tick would be wasted work
      const second = Math.floor(run.elapsed / SAVE_EVERY);
      if (previous !== 'running' || second !== this.lastSavedSecond) {
        this.lastSavedSecond = second;
        this.repository.save({ config: run.config, elapsed: run.elapsed });
      }
    } else if (run.phase === 'paused' && previous === 'running') {
      this.repository.save({ config: run.config, elapsed: run.elapsed });
    } else if (run.phase === 'finished') {
      this.repository.clear();
    }
  }

  private restore(): Run {
    try {
      const stored = this.repository.load();
      if (!stored) {
        return { phase: 'ready' };
      }
      const intervalle = toIntervalle(stored.config);
      const { elapsed } = stored;
      // also rejects a run without Intervalle: its total duration is 0
      const usable =
        typeof elapsed === 'number' &&
        elapsed >= 0 &&
        elapsed < totalDuration(intervalle);
      return usable
        ? { phase: 'paused', config: stored.config, intervalle, elapsed }
        : { phase: 'ready' };
    } catch {
      // stored by an older version or tampered with
      return { phase: 'ready' };
    }
  }

  private startClock(): void {
    this.lastTick = Date.now();
    this.clock ??= setInterval(() => this.tick(), TICK_PERIOD);
  }

  private stopClock(): void {
    if (this.clock != null) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  private tick(): void {
    const now = Date.now();
    // Date.now() can jump back (clock set back, NTP): never run backwards
    const delta = milliseconds(Math.max(0, now - this.lastTick));
    this.lastTick = now;
    const run = this.run();
    if (run.phase === 'leadIn') {
      const elapsed = add(run.elapsed, delta);
      if (elapsed < LEAD_IN) {
        this.update({ ...run, elapsed });
        return;
      }
      // a late tick (tab in the background) still counts as training time
      this.advanceRunning(
        { ...run, phase: 'running' as const, elapsed: ZERO_MS },
        subtract(elapsed, LEAD_IN)
      );
    } else if (run.phase === 'running') {
      this.advanceRunning(run, delta);
    }
  }

  private advanceRunning(
    run: Extract<Run, { intervalle: PlannedIntervall[] }>,
    delta: Milliseconds
  ): void {
    const elapsed = add(run.elapsed, delta);
    if (elapsed < totalDuration(run.intervalle)) {
      this.update({ ...run, elapsed });
    } else {
      this.finish(run.intervalle, totalDuration(run.intervalle), 'complete');
    }
  }

  private finish(
    intervalle: PlannedIntervall[],
    elapsed: Milliseconds,
    completion: Zusammenfassung['completion']
  ): void {
    this.stopClock();
    const sprints = intervalle.filter((i) => i.type === 'sprintWithDuration');
    this.update({
      phase: 'finished',
      zusammenfassung: {
        elapsed,
        sprintsCompleted: sprints.filter(
          (i) => add(i.start, i.duration) <= elapsed
        ).length,
        sprintsTotal: sprints.length,
        completion,
      },
    });
  }
}

function toIntervalle(config: TrainingConfigWithDuration): PlannedIntervall[] {
  const types: { type: ExerciseType; duration: Milliseconds }[] = [];
  for (const exercise of config.exercises) {
    if (exercise.type === 'intervalWithDuration') {
      for (let i = 0; i < exercise.repetitions; i++) {
        for (const inner of exercise.exercises) {
          types.push({ type: inner.type, duration: inner.timing.duration });
        }
      }
    } else {
      types.push({ type: exercise.type, duration: exercise.timing.duration });
    }
  }
  let start = ZERO_MS;
  return types.map(({ type, duration }) => {
    const intervall = { type, start, duration };
    start = add(start, duration);
    return intervall;
  });
}

function totalDuration(intervalle: PlannedIntervall[]): Milliseconds {
  return add(...intervalle.map((i) => i.duration));
}

function trainingName(type: ExerciseType): TrainingName {
  switch (type) {
    case 'sprintWithDuration':
      return 'sprint';
    case 'recoveryWithDuration':
      return 'recovery';
    case 'freeRunning':
    case 'freeRunningWithDuration':
      return 'running';
  }
}

function project(run: Run): TrainingRunView {
  switch (run.phase) {
    case 'ready':
      return { phase: 'ready' };
    case 'leadIn':
      return {
        phase: 'leadIn',
        left: subtract(LEAD_IN, run.elapsed),
        total: LEAD_IN,
      };
    case 'running':
    case 'paused': {
      const { intervalle, elapsed } = run;
      const index = intervalle.findIndex(
        (i) => elapsed < add(i.start, i.duration)
      );
      const intervall = intervalle[index];
      const next = intervalle[index + 1];
      const intervallElapsed = subtract(elapsed, intervall.start);
      return {
        phase: run.phase,
        current: {
          name: trainingName(intervall.type),
          index,
          count: intervalle.length,
          duration: intervall.duration,
          elapsed: intervallElapsed,
          left: subtract(intervall.duration, intervallElapsed),
        },
        next: next ? trainingName(next.type) : 'finished',
        elapsed,
      };
    }
    case 'finished':
      return { phase: 'finished', zusammenfassung: run.zusammenfassung };
  }
}
