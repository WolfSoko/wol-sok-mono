import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import {
  BehaviorSubject,
  EMPTY,
  from,
  interval,
  last,
  map,
  Observable,
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
  ],
})
export class GravityWorldComponent {
  private static readonly INITIAL_MASS_OF_SUN: number = 50000.0;
  private static readonly INITIAL_GRAVITY_CONSTANT: number = 60.0;

  public form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }> = this.nNfB.group({
    gravitationalConstant: GravityWorldComponent.INITIAL_GRAVITY_CONSTANT,
    massOfSun: GravityWorldComponent.INITIAL_MASS_OF_SUN,
  });

  private massSun$ = this.form.controls.massOfSun.valueChanges;
  private gravitationalConstant$ =
    this.form.controls.gravitationalConstant.valueChanges;

  public MAX_DIM = Vector2d.create(1000, 700);
  private CENTER_POS = this.MAX_DIM.div(2);
  // public listOfPlanets = [new Planet(, mass)];

  private planetsSubject$ = new Subject<Planet>();
  public planets$: Observable<Array<Planet>> = this.planetsSubject$
    .asObservable()
    .pipe(
      scan(
        (allPlanets: Array<Planet>, newPlanet: Planet) =>
          allPlanets.concat(newPlanet),
        new Array<Planet>()
      )
    );
  public planetsAmount$ = this.planets$.pipe(
    map((planets) => planets.length),
    startWith(0)
  );

  private mass$ = from([1]);

  private targetCoordinatesSubject: Subject<Vector2d> = new Subject<Vector2d>();
  private targetCoordinates$: Observable<Vector2d> =
    this.targetCoordinatesSubject.asObservable().pipe(shareReplay(1));
  private positionSubject$ = new Subject<Vector2d>();
  private position$: Observable<Vector2d> = this.positionSubject$
    .asObservable()
    .pipe(shareReplay(1));

  private simStart$ = new Subject<boolean>();

  x$: Observable<number>;
  y$: Observable<number>;

  mouseX$: Observable<number>;
  mouseY$: Observable<number>;

  private mouseDown$ = new Subject<MouseEvent>();
  private mouseMove$ = new Subject<MouseEvent>();
  private mouseUp$ = new Subject<MouseEvent>();

  private drag$: Observable<Vector2d> = this.mouseDown$.asObservable().pipe(
    switchMap(() =>
      this.mouseMove$.asObservable().pipe(
        map((mm: MouseEvent) => Vector2d.create(mm.offsetX, mm.offsetY)),
        takeUntil(this.mouseUp$.asObservable())
      )
    )
  );

  private noDrag$: Observable<MouseEvent> = this.mouseDown$.asObservable().pipe(
    switchMap(() =>
      this.mouseUp$
        .asObservable()
        .pipe(takeUntil(this.mouseMove$.asObservable()))
    ),
    last()
  );

  constructor(private nNfB: NonNullableFormBuilder) {
    const centerPositionMapper = (targetVector: Vector2d) =>
      targetVector.sub(this.CENTER_POS);

    const centeredTargetCoordinates$ = this.targetCoordinatesSubject
      .asObservable()
      .pipe(map(centerPositionMapper));

    const timedTargetCoordinates$ = this.simStart$.asObservable().pipe(
      switchMap((simStart: boolean) => {
        if (simStart) {
          return interval(10).pipe(timeInterval());
        }
        return EMPTY;
      }),
      withLatestFrom(
        centeredTargetCoordinates$,
        (interval: TimeInterval<number>, targetCoordinates: Vector2d) =>
          new TimeInterval(targetCoordinates, interval.interval / 1000)
      )
    );

    const centeredPosition$ = this.position$.pipe(map(centerPositionMapper));

    const calculateGravityForce = (
      position1: TimeInterval<Vector2d>,
      position2: Vector2d,
      mass1: number,
      mass2: number,
      gravityConst: number
    ) => {
      const distance = position1.value.dist(position2);
      const interval = position1.interval;
      if (Math.abs(distance) <= 0.5) {
        return new TimeInterval(Vector2d.zero, interval);
      }
      // newtons law shortened to a1 = G * m2 / r²
      const forceAmount = gravityConst * mass2 * (1 / Math.pow(distance, 1.3));
      const directedForce = position1.value
        .directionTo(position2)
        .mul(forceAmount);
      return new TimeInterval(directedForce.mul(interval), interval);
    };

    const gravitationalForceToApply$ = timedTargetCoordinates$.pipe(
      withLatestFrom(
        centeredPosition$,
        this.mass$,
        this.massSun$,
        this.gravitationalConstant$,
        // calculate the force
        calculateGravityForce
      )
    );

    const velocity$ = gravitationalForceToApply$.pipe(
      scan(
        (
          oldVelocity: TimeInterval<Vector2d>,
          forceInterval: TimeInterval<Vector2d>
        ) => {
          const newVelocity = oldVelocity.value.add(
            forceInterval.value.mul(forceInterval.interval)
          );
          return new TimeInterval(newVelocity, forceInterval.interval);
        },
        new TimeInterval(Vector2d.create(-100, 100), 20)
      )
    );

    const nextPosition$ = velocity$.pipe(
      withLatestFrom(
        this.position$,
        (timedVelocity: TimeInterval<Vector2d>, position: Vector2d) =>
          position.add(timedVelocity.value.mul(timedVelocity.interval))
      )
    );
    nextPosition$.subscribe((position) => this.positionSubject$.next(position));

    this.x$ = this.position$.pipe(map((vec) => vec.x));
    this.y$ = this.position$.pipe(map((vec) => vec.y));
    this.mouseX$ = this.targetCoordinates$.pipe(map((vec) => vec.x));
    this.mouseY$ = this.targetCoordinates$.pipe(map((vec) => vec.y));

    this.positionSubject$.next(this.CENTER_POS.sub(Vector2d.create(0, 30)));
    this.targetCoordinatesSubject.next(this.CENTER_POS);

    // trigger initial value changes
    this.form.enable();
  }

  mouseDown($event: MouseEvent) {
    this.noDrag$.subscribe({
      next: (event: MouseEvent) => this.addPlanet(event),
      error: (error) => console.error('error while no dragging', error),
      complete: () => console.log('end click'),
    });

    this.drag$.subscribe({
      next: (coord) => this.targetCoordinatesSubject.next(coord),
      error: (error) => console.error('error while dragging', error),
      complete: () => console.log('end drag'),
    });
    this.mouseDown$.next($event);
  }

  mouseUp($event: MouseEvent) {
    this.mouseUp$.next($event);
  }

  mouseMove($event: MouseEvent) {
    $event.preventDefault();
    this.mouseMove$.next($event);
  }

  addPlanet($event: MouseEvent) {
    console.log('addPlanet');
    this.planetsSubject$.next(new Planet($event.offsetX, $event.offsetY, 200));
  }

  startSim() {
    this.simStart$.next(true);
  }

  stopSim() {
    this.simStart$.next(false);
  }
}
