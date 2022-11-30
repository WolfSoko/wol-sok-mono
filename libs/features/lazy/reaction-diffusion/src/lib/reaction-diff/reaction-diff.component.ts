import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatLegacyCardModule as MatCardModule } from '@angular/material/legacy-card';
import { MatLegacyCheckboxModule as MatCheckboxModule } from '@angular/material/legacy-checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacySelectChange as MatSelectChange, MatLegacySelectModule as MatSelectModule } from '@angular/material/legacy-select';
import { MatLegacySlideToggleModule as MatSlideToggleModule } from '@angular/material/legacy-slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { ElevateCardDirective } from '@wolsok/ui-kit';
import { interval, Observable, Subject } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  share,
  startWith,
  tap,
} from 'rxjs/operators';
import { ReactionDiffCalcParams } from './calculation/reaction-diff-calc-params';
import { ReactionDiffCalcServiceFactory } from './calculation/reaction-diff-calculation-service.factory';
import { ReactionDiffCalculator } from './calculation/reaction-diff-calculator';
import { CellWeights } from './cell-weights-to-array';
import { P5ViewComponent } from './p5-view/p5-view.component';
import { ReactionDiffConfigService } from './reaction-diff-config.service';
import { WeightsConfigComponent } from './weights-config/weights-config.component';

interface Dimensions {
  width: number;
  height: number;
}

@Component({
  standalone: true,
  imports: [
    P5ViewComponent,
    WeightsConfigComponent,
    CommonModule,
    ElevateCardDirective,
    FormsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  selector: 'feat-lazy-react-diff-reaction-diff',
  templateUrl: './reaction-diff.component.html',
  styleUrls: ['./reaction-diff.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReactionDiffComponent implements OnInit, OnDestroy {
  public calcService!: ReactionDiffCalculator;
  public showFps = true;
  public width = 340;
  public height = 300;
  public numberWebWorkers!: number;
  public cellWeights$: Observable<CellWeights>;
  public calcParams!: ReactionDiffCalcParams;
  public examples!: string[];
  public selectedExample: string | null = null;
  public addChemicalRadius!: number;
  public speed = 1;
  public useGpu = true;
  dimensions$!: Observable<Dimensions>;
  calculationTime$!: Observable<string>;
  drawImageTime$!: Observable<number>;
  private dimensionsSubject$: Subject<Dimensions> = new Subject();

  constructor(
    private calcFactory: ReactionDiffCalcServiceFactory,
    private configService: ReactionDiffConfigService
  ) {
    this.cellWeights$ = this.configService.calcCellWeights$;
  }

  private _start = false;

  get start(): boolean {
    return this._start;
  }

  set start(start: boolean) {
    this._start = start;
  }

  public ngOnInit() {
    this.examples = this.configService.exampleOptions;

    this.calcService = this.calcFactory.createCalcService(
      this.width,
      this.height,
      this.useGpu
    );
    this.numberWebWorkers = this.calcService.numberThreads;

    this.configService.selectedExample$.subscribe(
      (example) => (this.selectedExample = example)
    );
    this.configService.calcParams$.subscribe(
      (calcParams) => (this.calcParams = calcParams)
    );
    this.configService.addChemicalRadius$.subscribe(
      (radius) => (this.addChemicalRadius = radius)
    );

    this.configService.speed$.subscribe((speed) => (this.speed = speed));

    this.calculationTime$ = interval(1000).pipe(
      map(() => {
        return performance.getEntriesByName('calcNext');
      }),
      map((measures: PerformanceEntryList) => {
        if (measures.length === 0) {
          return '0.0';
        }
        const measurementsToTake = Math.min(measures.length, 30);
        return (
          measures
            .slice(measures.length - measurementsToTake)
            .reduce((acc, next) => {
              return acc + next.duration;
            }, 0) / measurementsToTake
        ).toFixed(2);
      })
    );

    this.drawImageTime$ = interval(1000).pipe(
      map(() => performance.getEntriesByName('drawImage')),
      map((measures: PerformanceEntryList) => {
        if (measures.length === 0) {
          return 0;
        }
        const measurementsToTake = Math.min(measures.length, 30);
        return measures
          .slice(measures.length - measurementsToTake)
          .reduce((acc, next) => acc + next.duration / measurementsToTake, 0);
      })
    );

    const distinctDebouncedDimensions = this.dimensionsSubject$.pipe(
      filter((dim) => dim.width > 0 && dim.height > 0),
      tap((dim: Dimensions) => {
        this.width = dim.width;
        this.height = dim.height;
      }),
      debounceTime(500),
      distinctUntilChanged(
        (x, y) => x.width === y.width && y.height === x.height
      ),
      share()
    );
    distinctDebouncedDimensions.subscribe((dim) => {
      this.start = false;
      this.calcService.resize(dim.width, dim.height);
    });

    this.dimensions$ = distinctDebouncedDimensions.pipe(
      startWith({ width: this.width, height: this.height })
    );
  }

  public toggleRunSim(): void {
    this.start = !this.start;
  }

  public reset(): void {
    this.start = false;
    this.calcService.reset();
  }

  public addChemical(event: { x: number; y: number }): void {
    this.calcService.addChemical(event.x, event.y);
  }

  public resetParametersWeights(): void {
    this.configService.resetCalcParams();
    this.configService.resetCalcCellWeights();
  }

  public updateDimension(width: number, height: number): void {
    this.dimensionsSubject$.next({ width, height });
  }

  public updateCalcParams(calcParams: ReactionDiffCalcParams): void {
    this.configService.updateCalcParams(calcParams);
  }

  public updateWeights(weights: CellWeights): void {
    this.configService.updateCalcCellWeights(weights);
  }

  public setSelection(option: MatSelectChange): void {
    this.configService.setSelection(option.value);
  }

  public updateAddChemicalRadius(): void {
    this.configService.updateAddChemicalRadius(this.addChemicalRadius);
  }

  updateNumberOfWebWorkers(): void {
    this.calcService.updateNumberThreads(this.numberWebWorkers);
  }

  updateUseGpu(): void {
    this.start = false;
    this.calcService = this.calcFactory.createCalcService(
      this.width,
      this.height,
      this.useGpu
    );
    if (!this.useGpu) {
      this.numberWebWorkers = this.calcService.numberThreads;
    }
  }

  updateSpeed($event: number): void {
    this.configService.updateSpeed($event);
  }

  ngOnDestroy(): void {
    this.calcService.cleanup();
  }
}
