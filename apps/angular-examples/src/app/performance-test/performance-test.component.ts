import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ID } from '@datorama/akita';
import { Observable } from 'rxjs';
import { PerformanceTest } from './state/performance-test.model';
import { PerformanceTestQuery } from './state/performance-test.query';
import { ARRAY_ITEMS_LENGTH, PerformanceTestService } from './state/performance-test.service';

@Component({
  selector: 'app-performance-test',
  templateUrl: './performance-test.component.html',
  styleUrls: ['./performance-test.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerformanceTestComponent{
  readonly performanceTest$: Observable<PerformanceTest[]>;
  readonly isLoading$: Observable<boolean>;
  readonly activePerformanceTest$: Observable<PerformanceTest | undefined>;
  readonly arrayItems: number = ARRAY_ITEMS_LENGTH;

  constructor(private performanceTestQuery: PerformanceTestQuery,
              private performanceTestService: PerformanceTestService
  ) {
    this.performanceTest$ = this.performanceTestQuery.selectAll();
    this.isLoading$ = this.performanceTestQuery.selectLoading();
    this.activePerformanceTest$ = this.performanceTestQuery.selectActive();
  }

  add(performanceTest: Partial<PerformanceTest>) {
    this.performanceTestService.add(performanceTest);
  }

  update(id: ID, performanceTest: Partial<PerformanceTest>) {
    this.performanceTestService.update(id, performanceTest);
  }

  remove(id: ID) {
    this.performanceTestService.remove(id);
  }

  startTest(performanceTest: PerformanceTest) {
    this.performanceTestService.startTest(performanceTest).subscribe();
  }

  trackByPerformanceTestId(index: number, item: PerformanceTest) {
    return item.id;
  }
}
