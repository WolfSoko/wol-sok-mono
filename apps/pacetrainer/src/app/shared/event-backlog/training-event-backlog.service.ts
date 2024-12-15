import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { TrainingStateChange } from '../model/log-events/state-change.model';
import { RepositoryFactory } from '../repository/repository.factory';

type TrainingEventLogEntry = [time: Date, event: TrainingStateChange];
type TrainingEventLog = TrainingEventLogEntry[];

@Injectable({ providedIn: 'root' })
export class TrainingEventBacklogService {
  private readonly logRepository =
    inject(RepositoryFactory).create<TrainingEventLog>('trainingEventLog');

  private readonly trainingEventLog: WritableSignal<TrainingEventLog>;

  constructor() {
    this.trainingEventLog = signal(this.logRepository.load() ?? []);

    effect(() => {
      return this.logRepository.save(this.trainingEventLog());
    });
  }

  pushEntry(event: TrainingStateChange): void {
    this.trainingEventLog.update((log) => [...log, [new Date(), event]]);
  }
}
