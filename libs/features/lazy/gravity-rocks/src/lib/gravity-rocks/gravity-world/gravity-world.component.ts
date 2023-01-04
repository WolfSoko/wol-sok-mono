import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElemResizedDirective, LetDirective, ResizedEvent } from '@wolsok/ui-kit';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  interval,
  last,
  map,
  Observable,
  of,
  ReplaySubject,
  scan,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  takeUntil,
  timeInterval,
  withLatestFrom,
} from 'rxjs';
import { TimeInterval } from './time-interval';
import { Vector2d } from './vector-2d';

class Planet {
  constructor(public x: number, public y: number, public mass: number) {}
}

@Component({
  standalone: true,
  selector: 'feat-lazy-gravity-world',
  templateUrl: 'gravity-world.component.html',
  styleUrls: ['gravity-world.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatCardModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    LetDirective,
    ElemResizedDirective,
    MatIconModule,
  ],
})
export class GravityWorldComponent {
  private static readonly INITIAL_MASS_OF_SUN: number = 50000.0;
  private static readonly INITIAL_GRAVITY_CONSTANT: number = 60.0;

  @ViewChild('svgWorld')
  svgWorld!: ElementRef<SVGSVGElement>;

  public form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }> = this.nNfB.group({
    gravitationalConstant: GravityWorldComponent.INITIAL_GRAVITY_CONSTANT,
    massOfSun: GravityWorldComponent.INITIAL_MASS_OF_SUN,
  });

  private massSun$: Observable<number> = this.form.controls.massOfSun.valueChanges;
  private gravitationalConstant$: Observable<number> = this.form.controls.gravitationalConstant.valueChanges;

  public MAX_DIM: Vector2d = Vector2d.create(1000, (1000 / 5) * 3);
  private CENTER_POS: Vector2d = this.MAX_DIM.div(2);

  private planetsSubject$: Subject<Planet> = new Subject();
  public planets$: Observable<Planet[]> = this.planetsSubject$
    .asObservable()
    .pipe(scan((allPlanets: Array<Planet>, newPlanet: Planet) => [...allPlanets, newPlanet], []));
  public planetsAmount$: Observable<number> = this.planets$.pipe(
    map((planets: Array<Planet>) => planets.length),
    startWith(0)
  );
  private containerSizeSubject$: Subject<Vector2d> = new ReplaySubject<Vector2d>(1);

  private targetCoordinatesSubject: Subject<Vector2d> = new Subject<Vector2d>();
  private targetCoordinates$: Observable<Vector2d> = combineLatest([
    this.targetCoordinatesSubject.asObservable(),
    this.containerSizeSubject$,
    of(this.MAX_DIM),
  ]).pipe(
    map(([coords, containerSize, maxDims]) => {
      return coords.vMul(maxDims.vDiv(containerSize));
    }),
    shareReplay(1)
  );

  private positionSubject$: Subject<Vector2d> = new Subject<Vector2d>();
  private position$: Observable<Vector2d> = this.positionSubject$.asObservable().pipe(shareReplay(1));

  private runningSubject: Subject<boolean> = new BehaviorSubject<boolean>(false);
  public running$: Observable<boolean> = this.runningSubject.asObservable();

  x$: Observable<number>;
  y$: Observable<number>;

  mouseX$: Observable<number>;
  mouseY$: Observable<number>;

  private mouseDown$: Subject<MouseEvent> = new Subject();
  private mouseMove$: Subject<MouseEvent> = new Subject();
  private mouseUp$: Subject<MouseEvent> = new Subject();

  drag$: Observable<Vector2d> = this.mouseDown$.asObservable().pipe(
    switchMap(() =>
      this.mouseMove$.asObservable().pipe(
        map((mm: MouseEvent) => Vector2d.create(mm.offsetX, mm.offsetY)),
        takeUntil(this.mouseUp$.asObservable())
      )
    )
  );

  private noDrag$: Observable<MouseEvent> = this.mouseDown$.asObservable().pipe(
    switchMap(() => this.mouseUp$.asObservable().pipe(takeUntil(this.mouseMove$.asObservable()))),
    last()
  );

  constructor(private nNfB: NonNullableFormBuilder) {
    const centerPositionMapper: (targetVector: Vector2d) => Vector2d = (targetVector: Vector2d) =>
      targetVector.sub(this.CENTER_POS);

    const centeredTargetCoordinates$: Observable<Vector2d> = this.targetCoordinates$.pipe(map(centerPositionMapper));

    const timedTargetCoordinates$: Observable<TimeInterval<Vector2d>> = this.running$.pipe(
      switchMap((simStart: boolean) => {
        if (simStart) {
          return interval(10).pipe(timeInterval());
        }
        return EMPTY;
      }),
      withLatestFrom(centeredTargetCoordinates$),
      map(([interval, targetCoordinates]) => new TimeInterval(targetCoordinates, interval.interval / 1000))
    );

    const centeredPosition$: Observable<Vector2d> = this.position$.pipe(map(centerPositionMapper));

    const calculateGravityForce: (
      position1: TimeInterval<Vector2d>,
      position2: Vector2d,
      mass1: number,
      mass2: number,
      gravityConst: number
    ) => TimeInterval<Vector2d> = (
      position1: TimeInterval<Vector2d>,
      position2: Vector2d,
      mass1: number,
      mass2: number,
      gravityConst: number
    ) => {
      const distance: number = position1.value.dist(position2);
      const interval: number = position1.interval;
      if (Math.abs(distance) <= 0.5) {
        return new TimeInterval(Vector2d.zero, interval);
      }
      // newtons law shortened to a1 = G * m2 / r²
      const forceAmount: number = gravityConst * mass2 * (1 / Math.pow(distance, 1.3));
      const directedForce: Vector2d = position1.value.directionTo(position2).mul(forceAmount);
      return new TimeInterval(directedForce.mul(interval), interval);
    };

    const gravitationalForceToApply$: Observable<TimeInterval<Vector2d>> = timedTargetCoordinates$.pipe(
      withLatestFrom(centeredPosition$, of(1), this.massSun$, this.gravitationalConstant$, calculateGravityForce)
    );

    const velocity$: Observable<TimeInterval<Vector2d>> = gravitationalForceToApply$.pipe(
      scan((oldVelocity: TimeInterval<Vector2d>, forceInterval: TimeInterval<Vector2d>) => {
        const newVelocity: Vector2d = oldVelocity.value.add(forceInterval.value.mul(forceInterval.interval));
        return new TimeInterval(newVelocity, forceInterval.interval);
      }, new TimeInterval(Vector2d.create(-100, 100), 20))
    );

    const nextPosition$: Observable<Vector2d> = velocity$.pipe(
      withLatestFrom(this.position$),
      map(([timedVelocity, position]) => position.add(timedVelocity.value.mul(timedVelocity.interval)))
    );
    nextPosition$.subscribe((position) => this.positionSubject$.next(position));

    this.x$ = this.position$.pipe(map((vec: Vector2d) => vec.x));
    this.y$ = this.position$.pipe(map((vec: Vector2d) => vec.y));
    this.mouseX$ = this.targetCoordinates$.pipe(map((vec: Vector2d) => vec.x));
    this.mouseY$ = this.targetCoordinates$.pipe(map((vec: Vector2d) => vec.y));

    this.positionSubject$.next(this.CENTER_POS.sub(Vector2d.create(0, 30)));
    this.targetCoordinatesSubject.next(this.CENTER_POS);

    // trigger initial value changes
    this.form.enable();
  }

  resize($event: ResizedEvent) {
    this.containerSizeSubject$.next(new Vector2d($event.newWidth, $event.newHeight));
  }

  mouseDown($event: MouseEvent): void {
    this.noDrag$.subscribe({
      next: (event: MouseEvent) => this.addPlanet(event),
      error: (error) => console.error('error while no dragging', error),
      complete: () => console.log('end click'),
    });

    this.drag$.subscribe({
      next: (coord: Vector2d) => this.targetCoordinatesSubject.next(coord),
      error: (error) => console.error('error while dragging', error),
      complete: () => console.log('end drag'),
    });
    this.mouseDown$.next($event);
  }

  mouseUp($event: MouseEvent): void {
    this.mouseUp$.next($event);
  }

  mouseMove($event: MouseEvent): void {
    this.mouseMove$.next($event);
  }

  addPlanet($event: MouseEvent): void {
    console.log('addPlanet');
    this.planetsSubject$.next(new Planet($event.offsetX, $event.offsetY, 200));
  }

  startSim(): void {
    this.runningSubject.next(true);
  }

  stopSim(): void {
    this.runningSubject.next(false);
  }

  toggleSim(running: boolean): void {
    running ? this.stopSim() : this.startSim();
  }
}
