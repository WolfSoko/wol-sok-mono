import { Injectable } from '@angular/core';
import { defer, Observable, of, range, Subject, Subscription } from 'rxjs';
import {
  map,
  scan,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
  toArray,
} from 'rxjs/operators';
import { RandomService } from '../core/random.service';
import { PoissonConfigService } from './poisson-config.service';
import { Circle } from './shared/circle';
import { Line } from './shared/line';
import { ShapeFactoryService } from './shared/shape-factory.service';
import { Vector } from './shared/vector';

type RandomActive = {
  active: Vector;
  randomActiveIndex: number;
};

@Injectable()
export class PoissonCalcService {
  public foundCircles$!: Observable<Circle[]>;
  public activeVectors$!: Observable<Vector[]>;
  public lines$!: Observable<Line[]>;
  private height!: number;
  private width!: number;
  private r!: number;
  private k!: number;
  private readonly w: number;
  private cols!: number;
  private rows!: number;
  private grid: Circle[][] = [];
  private active: Vector[] = [];
  private foundCirclesSubject!: Subject<Circle>;
  private activesSubject!: Subject<Vector[]>;
  private lineSubject!: Subject<Line>;
  private linesSubject!: Subject<Line[]>;
  private iterationsPerFrame!: number;
  private subscriptions: Subscription = new Subscription();

  private calculationSubject!: Subject<void>;

  private calculationCompletedSubject!: Subject<void>;

  constructor(
    private readonly poissonConfig: PoissonConfigService,
    private readonly shapeFactory: ShapeFactoryService,
    private readonly random: RandomService
  ) {
    this.subscriptions.add(
      this.poissonConfig.iterationsPerFrame$.subscribe(
        (iterations) => (this.iterationsPerFrame = iterations)
      )
    );
    this.subscriptions.add(
      this.poissonConfig.k$.subscribe((k) => (this.k = k))
    );
    this.subscriptions.add(
      this.poissonConfig.r$.subscribe((r) => (this.r = r))
    );

    this.w = this.poissonConfig.w;
  }

  public setup(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.rows = Math.floor(this.width / this.w);
    this.cols = Math.floor(this.height / this.w);
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

  public calculate(): void {
    this.lineSubject = new Subject();
    this.lineSubject
      .pipe(takeUntil(this.calculationCompletedSubject), toArray())
      .subscribe((lines) => this.linesSubject.next(lines));
    this.calculationSubject.next();
  }

  public addPointForCalculation(vec: Vector): void {
    this.addToGrid(vec);
    this.addToActive(vec);
  }

  private initCalculation(): void {
    const iterationsPerFrame$: Observable<number> = defer(() =>
      range(0, this.iterationsPerFrame)
    ).pipe(
      takeWhile(() => this.active.length > 0),
      tap(undefined, undefined, () => this.calculationCompletedSubject.next())
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
        switchMap(() => randomActive$),
        tap((randomActive) => this.onNextCalculation(randomActive))
      )
      .subscribe({
        error: (error) => console.error('error calculating', error),
        complete: () => console.log('Calculation completed'),
      });
  }

  private onNextCalculation({ active, randomActiveIndex }: RandomActive): void {
    let found = false;
    const currentDistance = this.currentDistanceForPos(active);
    for (let n = 0; n < this.k; n++) {
      const sample = this.shapeFactory
        .randomVector()
        .setMag(this.random.random(currentDistance, 2 * currentDistance))
        .addVec(active);

      /*this.drawHelper
        .setFillColor('blue')
        .drawVec(sample, currentDistance * 0.2);*/

      const row = Math.floor(sample.x / this.w);
      const col = Math.floor(sample.y / this.w);

      if (
        col > -1 &&
        row > -1 &&
        col < this.cols &&
        row < this.rows &&
        !this.getFromGrid(sample)
      ) {
        const neighbours: Circle[] = this.getNeighbours(
          sample,
          currentDistance
        );
        const ok = neighbours.every((neighbour: Circle) => {
          // this.drawHelper.setStrokeColor('white');
          if (neighbour) {
            this.lineSubject.next(
              this.shapeFactory.createLine(sample, neighbour.pos)
            );
            /*  .setFillColor('green')
                .drawCircle(neighbour, this.step);
            */
            const sampleRadius = this.currentCircleRadius(sample);
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
          this.addToGrid(sample, this.currentCircleRadius(sample));
          this.addToActive(sample);
        }
      }
    }
    if (!found) {
      this.removeFromActive(randomActiveIndex);
    }
  }

  private getFromGrid(vec: Vector): Circle {
    const x = Math.floor(vec.x / this.w);
    const y = Math.floor(vec.y / this.w);
    return this.grid[x][y];
  }

  private addToGrid(
    vec: Vector,
    circleRadius: number = this.currentCircleRadius(vec)
  ): void {
    const x = Math.floor(vec.x / this.w);
    const y = Math.floor(vec.y / this.w);

    const circle = this.shapeFactory.createCircle(vec, circleRadius);
    this.grid[x][y] = circle;
    this.foundCirclesSubject.next(circle);
  }

  private getNeighbours(vec: Vector, distance: number = this.r): Circle[] {
    const cellWidth = this.w;
    const row = Math.floor(vec.x / cellWidth);
    const col = Math.floor(vec.y / cellWidth);
    const distanceCheck = this.isInDistanceFactory(row, col, distance);
    const result: Circle[] = [];

    this.grid.forEach((colVecs: Circle[], rowToCheck: number) =>
      colVecs.forEach((neighbour: Circle, colToCheck: number) => {
        if (distanceCheck(rowToCheck, colToCheck)) {
          result.push(neighbour);
        }
      })
    );
    return result;
  }

  private currentCircleRadius(vector: Vector) {
    const radius = this.currentDistanceForPos(vector);
    return radius * 0.2;
  }

  private currentDistanceForPos(pos: Vector) {
    return this.r * (1 + 2 * Math.abs(Math.sin((pos.x + pos.y) * 0.01)));
  }

  private isInDistanceFactory(
    row: number,
    col: number,
    distance: number
  ): (rowToCheck: number, colToCheck: number) => boolean {
    return (rowToCheck: number, colToCheck: number) =>
      this.isInDistance(rowToCheck - row, colToCheck - col, distance);
  }

  private isInDistance(dr: number, dc: number, distance: number): boolean {
    const rowW = this.w * dr;
    const colW = this.w * dc;
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
