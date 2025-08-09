import { Injectable, inject } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import {
  PerformanceTestStore,
  PerformanceTestState,
} from './performance-test.store';
import { PerformanceTest } from './performance-test.model';

@Injectable({
  providedIn: 'root',
})
export class PerformanceTestQuery extends QueryEntity<
  PerformanceTestState,
  PerformanceTest
> {
  protected store: PerformanceTestStore;

  constructor() {
    const store = inject(PerformanceTestStore);

    super(store);

    this.store = store;
  }
}
