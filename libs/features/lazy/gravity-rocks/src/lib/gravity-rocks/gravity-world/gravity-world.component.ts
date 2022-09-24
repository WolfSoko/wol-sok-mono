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

  public MAX_DIM = Vector2d.create(1000, 700);
  private CENTER_POS = this.MAX_DIM.div(2);
  // public listOfPlanets = [new Planet(, mass)];

  private planets$ = new Subject<Planet>();
  public planetsObs$: Observable<Array<Planet>> = this.planets$
    .asObservable()
    .pipe(
      scan(
        (allPlanets: Array<Planet>, newPlanet: Planet) =>
          allPlanets.concat(newPlanet),
        new Array<Planet>()
      )
    );
  public planetsAmount$ = this.planetsObs$.pipe(
    map((planets) => planets.length),
    startWith(0)
  );

  private mass$ = from([1]);
  public massSunSubject$ = new BehaviorSubject<number>(
    GravityWorldComponent.INITIAL_MASS_OF_SUN
  );
  public massSun$ = this.massSunSubject$.asObservable();
  private targetCoordinates$: Subject<Vector2d> = new Subject<Vector2d>();
  private targetCoordinatesObs$: Observable<Vector2d> = this.targetCoordinates$
    .asObservable()
    .pipe(shareReplay(1));
  private positionEmitter$ = new Subject<Vector2d>();
  private positionObs$: Observable<Vector2d> = this.positionEmitter$
    .asObservable()
    .pipe(shareReplay(1));

  private gravitationalConstantSubject = new Subject<number>();
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

  public form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }> = this.nNfB.group({
    gravitationalConstant: GravityWorldComponent.INITIAL_GRAVITY_CONSTANT,
    massOfSun: GravityWorldComponent.INITIAL_MASS_OF_SUN,
  });

  constructor(private nNfB: NonNullableFormBuilder) {
    const centerPositionMapper = (targetVector: Vector2d) =>
      targetVector.sub(this.CENTER_POS);

    const centeredTargetCoordinates$ = this.targetCoordinates$
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

    const centeredPosition$ = this.positionObs$.pipe(map(centerPositionMapper));

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
        this.gravitationalConstantSubject,
        // calculate the force
        calculateGravityForce
      )
    );

    this.form.controls.gravitationalConstant.valueChanges.subscribe((force) =>
      this.gravitationalConstantSubject.next(force)
    );

    this.form.controls.massOfSun.valueChanges.subscribe((massOfSun) =>
      this.massSunSubject$.next(massOfSun)
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
        this.positionObs$,
        (timedVelocity: TimeInterval<Vector2d>, position: Vector2d) =>
          position.add(timedVelocity.value.mul(timedVelocity.interval))
      )
    );
    nextPosition$.subscribe((position) => this.positionEmitter$.next(position));

    this.x$ = this.positionObs$.pipe(map((vec) => vec.x));
    this.y$ = this.positionObs$.pipe(map((vec) => vec.y));
    this.mouseX$ = this.targetCoordinatesObs$.pipe(map((vec) => vec.x));
    this.mouseY$ = this.targetCoordinatesObs$.pipe(map((vec) => vec.y));

    this.positionEmitter$.next(this.CENTER_POS.sub(Vector2d.create(0, 30)));
    this.targetCoordinates$.next(this.CENTER_POS);
  }

  mouseDown($event: MouseEvent) {
    this.noDrag$.subscribe({
      next: (event: MouseEvent) => this.addPlanet(event),
      error: (error) => console.error('error while no dragging', error),
      complete: () => console.log('end click'),
    });

    this.drag$.subscribe({
      next: (coord) => this.targetCoordinates$.next(coord),
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
    this.planets$.next(new Planet($event.offsetX, $event.offsetY, 200));
  }

  startSim() {
    this.simStart$.next(true);
  }

  stopSim() {
    this.simStart$.next(false);
  }
}
