import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { RandomService } from '@wolsok/utils-math';
import {
  combineLatest,
  defer,
  merge,
  Observable,
  of,
  range,
  Subject,
} from 'rxjs';
import {
  concatMap,
  distinctUntilChanged,
  map,
  scan,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  toArray,
} from 'rxjs/operators';
import { Circle } from './model/circle';
import { Line } from './model/line';
import { PoissonConfig } from './model/poisson.config';
import { Vector } from './model/vector';
import { PoissonConfigService } from './poisson-config.service';
import { ShapeFactoryService } from './shape-factory.service';

type RandomActive = {
  active: Vector;
  randomActiveIndex: number;
};

@UntilDestroy()
@Injectable()
export class PoissonCalcService {
  public foundCircles$!: Observable<Circle[]>;
  public drawnCircles$!: Observable<Circle[]>;
  public activeVectors$!: Observable<Vector[]>;
  public lines$!: Observable<Line[]>;
  private height!: number;
  private width!: number;
  private cols!: number;
  private rows!: number;

  private grid: Circle[][] = [];
  private active: Vector[] = [];
  private foundCirclesSubject!: Subject<Circle>;
  private activesSubject!: Subject<Vector[]>;
  private lineSubject!: Subject<Line>;
  private linesSubject!: Subject<Line[]>;
  private config$: Observable<PoissonConfig>;

  private calculationSubject!: Subject<void>;

  private calculationCompletedSubject!: Subject<void>;
  private iterationComplete = new Subject<void>();

  constructor(
    private readonly poissonConfig: PoissonConfigService,
    private readonly shapeFactory: ShapeFactoryService,
    private readonly random: RandomService
  ) {
    this.config$ = this.poissonConfig.config$;
  }

  public setup(width: number, height: number) {
    this.config$
      .pipe(take(1), untilDestroyed(this))
      .subscribe((config) => this.setupInternal(width, height, config));
  }

  private setupInternal(
    width: number,
    height: number,
    config: PoissonConfig
  ): void {
    this.width = width;
    this.height = height;

    this.rows = Math.floor(this.width / config.w);
    this.cols = Math.floor(this.height / config.w);
    this.grid = [];
    this.active = [];

    this.grid = new Array(this.rows);
    for (let i = 0; i < this.rows; i++) {
      this.grid[i] = new Array<Circle>(this.cols);
    }

    if (this.foundCirclesSubject) {
      this.foundCirclesSubject.complete();
    }
    this.foundCirclesSubject = new Subject<Circle>();
    this.foundCircles$ = this.foundCirclesSubject.asObservable().pipe(
      scan((pre: Circle[], current: Circle) => {
        pre.push(current);
        return pre;
      }, [])
    );
    this.drawnCircles$ = this.foundCircles$.pipe(
      map((circles) => circles.filter((circle) => circle.drawn))
    );

    if (this.activesSubject) {
      this.activesSubject.complete();
    }
    this.activesSubject = new Subject<Vector[]>();
    this.activeVectors$ = this.activesSubject.asObservable();

    this.calculationCompletedSubject = new Subject<void>();

    if (this.linesSubject) {
      this.linesSubject.complete();
    }
    this.lineSubject = new Subject<Line>();
    this.linesSubject = new Subject<Line[]>();
    this.lines$ = this.linesSubject.asObservable();
    this.calculationSubject = new Subject<void>();

    this.initCalculation();
  }

  public calculate(step = false): void {
    this.lineSubject = new Subject();
    this.lineSubject
      .pipe(
        takeUntil(merge(this.iterationComplete.asObservable())),
        toArray(),
        untilDestroyed(this)
      )
      .subscribe((lines) => this.linesSubject.next(lines));
    this.calculationSubject.next();
  }

  public addPointForCalculation(vec: Vector): void {
    if (this.active.length === 0) {
      this.initCalculation();
    }
    this.config$.pipe(take(1)).subscribe((config) => {
      this.addToGrid(vec, config.r, config.w);
      this.addToActive(vec);
    });
  }

  private initCalculation(): void {
    const iterationsPerFrame$: Observable<number> =
      this.poissonConfig.config$.pipe(
        map((value) => value.iterationsPerFrame),
        distinctUntilChanged(),
        switchMap((iterationsPerFrame) =>
          range(0, iterationsPerFrame).pipe(
            tap({ complete: () => this.iterationComplete.next() })
          )
        )
      );

    const randomActiveIndex$: Observable<number> = defer(() =>
      of(Math.floor(this.random.randomTo(this.active.length)))
    );

    const randomActive$: Observable<RandomActive> = randomActiveIndex$.pipe(
      map((randomActiveIndex) => ({
        active: this.active[randomActiveIndex],
        randomActiveIndex,
      }))
    );

    this.calculationSubject
      .pipe(
        switchMap(() => iterationsPerFrame$),
        concatMap(() =>
          combineLatest([randomActive$, this.config$.pipe(take(1))])
        ),
        takeWhile(() => this.active.length > 0),
        untilDestroyed(this)
      )
      .subscribe({
        next: ([randomActive, config]) =>
          this.onNextCalculation(randomActive, config),
        error: (error) => console.error('error calculating', error),
        complete: () => {
          this.calculationCompletedSubject.next();
          this.linesSubject.next([]);
        },
      });
  }

  private onNextCalculation(
    { active, randomActiveIndex }: RandomActive,
    { k, r, w }: PoissonConfig
  ): void {
    let found = false;
    const currentDistance = this.currentDistanceForPos(active, r);
    for (let n = 0; n < k; n++) {
      const sample = this.shapeFactory
        .randomVector()
        .setMag(this.random.random(currentDistance, 2 * currentDistance))
        .addVec(active);

      const row = Math.floor(sample.x / w);
      const col = Math.floor(sample.y / w);

      if (
        col > -1 &&
        row > -1 &&
        col < this.cols &&
        row < this.rows &&
        !this.getFromGrid(sample, w)
      ) {
        const neighbours: Circle[] = this.getNeighbours(
          sample,
          currentDistance,
          w
        );
        const ok = neighbours.every((neighbour: Circle) => {
          if (neighbour) {
            this.lineSubject.next(
              this.shapeFactory.createLine(sample, neighbour.pos)
            );

            const sampleRadius = this.currentCircleRadius(sample, r);
            const dQuad = sample.fastDist(neighbour.pos);
            const distanceQuad = currentDistance * currentDistance;
            const radiQuad =
              sampleRadius * sampleRadius + neighbour.r * neighbour.r;
            return dQuad - radiQuad >= distanceQuad;
          }
          return false;
        });

        if (ok) {
          found = true;
          this.addToGrid(sample, this.currentCircleRadius(sample, r), w);
          this.addToActive(sample);
        }
      }
    }
    if (!found) {
      this.removeFromActive(randomActiveIndex);
    }
  }

  private getFromGrid(vec: Vector, w: number): Circle {
    const x = Math.floor(vec.x / w);
    const y = Math.floor(vec.y / w);
    return this.grid[x][y];
  }

  private addToGrid(
    vec: Vector,
    r: number,
    w: number,
    circleRadius: number = this.currentCircleRadius(vec, r)
  ): void {
    const x = Math.floor(vec.x / w);
    const y = Math.floor(vec.y / w);

    const circle = this.shapeFactory.createCircle(vec, circleRadius);
    this.grid[x][y] = circle;
    this.foundCirclesSubject.next(circle);
  }

  private getNeighbours(vec: Vector, r: number, w: number): Circle[] {
    const cellWidth = w;
    const row = Math.floor(vec.x / cellWidth);
    const col = Math.floor(vec.y / cellWidth);
    const distanceCheck = this.isInDistanceFactory(row, col, r, w);
    const result: Circle[] = [];

    const maxDeltaIndex: number = Math.ceil(r / w);
    const minRow = Math.max(0, row - maxDeltaIndex);
    const maxRow = Math.min(row + maxDeltaIndex, this.grid.length);

    for (let rowToCheck = minRow; rowToCheck < maxRow; rowToCheck++) {
      const colVecs: Circle[] = this.grid[rowToCheck];
      const minCol = Math.max(0, col - maxDeltaIndex);
      const maxCol = Math.min(col + maxDeltaIndex, colVecs.length);
      for (let colToCheck = minCol; colToCheck < maxCol; colToCheck++) {
        const neighbour: Circle = colVecs[colToCheck];
        if (!neighbour) {
          continue;
        }
        if (distanceCheck(rowToCheck, colToCheck)) {
          result.push(neighbour);
        }
      }
    }
    return result;
  }

  private currentCircleRadius(vector: Vector, r: number) {
    const radius = this.currentDistanceForPos(vector, r);
    return radius * 0.2;
  }

  private currentDistanceForPos(pos: Vector, r: number) {
    return r * (1 + 2 * Math.abs(Math.sin((pos.x + pos.y) * 0.01)));
  }

  private isInDistanceFactory(
    row: number,
    col: number,
    distance: number,
    w: number
  ): (rowToCheck: number, colToCheck: number) => boolean {
    return (rowToCheck: number, colToCheck: number) =>
      this.isInDistance(rowToCheck - row, colToCheck - col, distance, w);
  }

  private isInDistance(
    dr: number,
    dc: number,
    distance: number,
    w: number
  ): boolean {
    const rowW = w * dr;
    const colW = w * dc;
    return distance * distance >= rowW * rowW + colW * colW;
  }

  private addToActive(vec: Vector): void {
    this.active.push(vec);
    this.activesSubject.next(this.active);
  }

  private removeFromActive(index: number): void {
    this.active.splice(index, 1);
    this.activesSubject.next(this.active);
  }
}
