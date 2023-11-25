import { Injectable } from '@angular/core';
import { ID, transaction } from '@datorama/akita';
import {
  animationFrameScheduler,
  defer,
  Observable,
  of,
  queueScheduler,
  range,
  timer,
} from 'rxjs';
import { map, reduce, switchMap, tap } from 'rxjs/operators';
import {
  createPerformanceTest,
  createPerformanceTestResult,
  PerformanceTest,
  PerformanceTestResults,
} from './performance-test.model';
import { PerformanceTestStore } from './performance-test.store';

export const ARRAY_ITEMS_LENGTH = 30_000_000;

const calcMeanTime = (
  previousValue: number,
  currentValue: PerformanceEntry,
  index: number,
  list: PerformanceEntryList
): number => previousValue + (1 / list.length) * currentValue.duration;

@Injectable({ providedIn: 'root' })
export class PerformanceTestService {
  private static calcMeanTime(entriesName: string): number {
    return (
      Math.round(
        performance.getEntriesByName(entriesName).reduce(calcMeanTime, 0) * 100
      ) / 100
    );
  }

  constructor(private performanceTestStore: PerformanceTestStore) {}

  @transaction()
  add(performanceTest: Partial<PerformanceTest>) {
    this.performanceTestStore.add(createPerformanceTest(performanceTest));
    this.performanceTestStore.setLoading(false);
  }

  update(id: ID, performanceTest: Partial<PerformanceTest>): void {
    this.performanceTestStore.update(id, performanceTest);
  }

  remove(id: ID) {
    this.performanceTestStore.remove(id);
  }

  startTest(
    performanceTest: PerformanceTest
  ): Observable<PerformanceTestResults> {
    this.performanceTestStore.setActive(performanceTest.id);

    const test$: Observable<PerformanceTestResults> =
      performanceTest.id === 0 ? this.createArrayTest() : this.createRxTest();
    return timer(10, animationFrameScheduler).pipe(
      switchMap(() => test$),
      tap((result: PerformanceTestResults) => {
        this.update(performanceTest.id, {
          result,
          runs: performanceTest.runs + 1,
          ui: {
            ...performanceTest.ui,
            progress: 100,
            duration: result[result.length - 1][1],
          },
        });
        this.performanceTestStore.setActive(null);
      })
    );
  }

  private createArrayTest(): Observable<PerformanceTestResults> {
    return defer(() => {
      performance.mark('startMark');
      const testArray = Array.from(Array(ARRAY_ITEMS_LENGTH).keys());
      performance.mark('arrayCreationEndMark');
      testArray.reduce(
        (previousValue, currentValue) => previousValue + currentValue
      );
      performance.mark('endMark');
      performance.measure('arrayCreation', 'startMark', 'arrayCreationEndMark');
      performance.measure('arrayReduceTest', 'startMark', 'endMark');
      performance.measure('arrayReduceTime', 'arrayCreationEndMark', 'endMark');

      const arrayCreation =
        PerformanceTestService.calcMeanTime('arrayCreation');
      const completeTime =
        PerformanceTestService.calcMeanTime('arrayReduceTest');
      const sumTime = PerformanceTestService.calcMeanTime('arrayReduceTime');
      return of([
        createPerformanceTestResult('creation time', arrayCreation),
        createPerformanceTestResult('sum time', sumTime),
        createPerformanceTestResult('complete time', completeTime),
      ]);
    });
  }

  private createRxTest(): Observable<PerformanceTestResults> {
    performance.mark('startMark');
    return range(0, ARRAY_ITEMS_LENGTH, queueScheduler).pipe(
      reduce((previousValue, currentValue) => previousValue + currentValue, 0),
      tap(() => {
        performance.mark('endMark');
        performance.measure('rxReduceTest', 'startMark', 'endMark');
      }),
      map(() => {
        const completeTime =
          PerformanceTestService.calcMeanTime('rxReduceTest');
        return [createPerformanceTestResult('complete time', completeTime)];
      })
    );
  }
}
