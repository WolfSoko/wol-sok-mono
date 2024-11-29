import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { SprintTrainingInputData } from './sprint-training-input.data';
import { SprintTrainingData } from './sprint-training.data';

@Injectable({
  providedIn: 'root',
})
export class SprintTrainingDataService {
  private readonly localStorageKey = 'sprintTrainingData';

  // Define signals for the state
  repetitions = signal<number>(4);
  sprintTime = signal<number>(10);
  recoveryTime = signal<number>(60);
  totalTime = computed(
    () => this.repetitions() * (this.sprintTime() + this.recoveryTime())
  );

  data = computed<SprintTrainingData>(() => ({
    repetitions: this.repetitions(),
    sprintTime: this.sprintTime(),
    recoveryTime: this.recoveryTime(),
    totalTime: this.totalTime(),
  }));

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    this.loadFromLocalStorage();
    effect(() => this.saveToLocalStorage());
  }

  private saveToLocalStorage(): void {
    if (!this.isBrowser) {
      return;
    }
    const data: SprintTrainingInputData = {
      repetitions: this.repetitions(),
      sprintTime: this.sprintTime(),
      recoveryTime: this.recoveryTime(),
    };
    localStorage?.setItem(this.localStorageKey, JSON.stringify(data));
  }

  private loadFromLocalStorage(): void {
    if (!this.isBrowser) {
      return;
    }
    const data = localStorage?.getItem(this.localStorageKey);
    if (data) {
      const parsedData: SprintTrainingInputData = JSON.parse(data);
      this.repetitions.set(parsedData.repetitions);
      this.sprintTime.set(parsedData.sprintTime);
      this.recoveryTime.set(parsedData.recoveryTime);
    }
  }

  updateState({
    repetitions,
    sprintTime,
    recoveryTime,
  }: Partial<SprintTrainingInputData>): void {
    if (repetitions) {
      this.repetitions.set(repetitions);
    }
    if (sprintTime) {
      this.sprintTime.set(sprintTime);
    }
    if (recoveryTime) {
      this.recoveryTime.set(recoveryTime);
    }
  }
}
