import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Signal,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ElemResizedDirective, LetDirective, ResizedEvent } from '@wolsok/ui-kit';
import { last, map, Observable, Subject, switchMap, takeUntil } from 'rxjs';
import { GravityWorldService } from './gravity-world.service';
import { Vector2d } from './vector-2d';
import { SpringForce } from './world-objects/force';
import { Planet } from './world-objects/planet';
import { Sun } from './world-objects/sun';

interface Settings {
  gravitationalConstant: number;
  massOfSun: number;
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
  private static readonly INITIAL_MASS_OF_SUN: number = 100000.0;
  private static readonly INITIAL_GRAVITY_CONSTANT: number = 6;
  public MAX_DIM: Vector2d = Vector2d.create(1000, (1000 / 5) * 3);

  @ViewChild('svgWorld')
  svgWorld!: ElementRef<SVGSVGElement>;

  public form: FormGroup<{
    gravitationalConstant: FormControl<number>;
    massOfSun: FormControl<number>;
  }>;

  private settings: Signal<Settings>;

  public running = signal(false);
  sun!: Sun;
  planets: WritableSignal<Planet[]> = signal([]);

  private canvasSize: WritableSignal<Vector2d> = signal(this.MAX_DIM);

  private mouseDown$: Subject<MouseEvent> = new Subject();
  private mouseMove$: Subject<MouseEvent> = new Subject();
  private mouseUp$: Subject<MouseEvent> = new Subject();

  drag$: Observable<{ start: Vector2d; end: Vector2d }> = this.mouseDown$.asObservable().pipe(
    map((mouseDownEvent: MouseEvent) => Vector2d.create(mouseDownEvent.offsetX, mouseDownEvent.offsetY)),
    switchMap((start: Vector2d) =>
      this.mouseMove$.asObservable().pipe(
        map((mm: MouseEvent) => ({ start, end: Vector2d.create(mm.offsetX, mm.offsetY) })),
        takeUntil(this.mouseUp$.asObservable())
      )
    )
  );

  private noDrag$: Observable<MouseEvent> = this.mouseDown$.asObservable().pipe(
    switchMap(() => this.mouseUp$.asObservable().pipe(takeUntil(this.mouseMove$.asObservable()))),
    last()
  );

  private sunToMouseSpring!: SpringForce;

  constructor(
    private readonly worldService: GravityWorldService,
    nNfB: NonNullableFormBuilder
  ) {
    const initialSettings: Settings = {
      gravitationalConstant: GravityWorldComponent.INITIAL_GRAVITY_CONSTANT,
      massOfSun: GravityWorldComponent.INITIAL_MASS_OF_SUN,
    };
    this.form = nNfB.group(initialSettings);

    this.settings = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue() as Settings)), {
      initialValue: initialSettings,
    });
    this.initializeSunAndPlanets();
    this.initializeDragSunToMouseSpring();

    this.updatePlanets();

    effect(() => {
      this.worldService.setUniverse(this.canvasSize().x, this.canvasSize().y, this.settings().gravitationalConstant);
    });
    effect(() => (this.running() ? this.gameLoop() : null));
  }

  private initializeSunAndPlanets(): void {
    this.sun = new Sun(this.calcCenteredVec(), undefined, GravityWorldComponent.INITIAL_MASS_OF_SUN);

    this.worldService.addWorldObject(this.sun);

    this.worldService.addWorldObject(new Planet(this.calcCenteredVec(new Vector2d(0, 100)), new Vector2d(-40, 0), 100));
    const planet2Pos: Vector2d = new Vector2d(-200, -150);
    this.worldService.addWorldObject(
      new Planet(this.calcCenteredVec(planet2Pos), planet2Pos.orthogonalTo(this.sun.pos).mul(30), 200)
    );
  }

  private calcCenteredVec(vec: Vector2d = new Vector2d(0, 0)): Vector2d {
    return this.canvasSize().div(2).add(vec);
  }

  private updatePlanets(): void {
    this.planets.set(this.worldService.getWorldObjects().filter((wo) => wo instanceof Planet) as Array<Planet>);
  }

  resize($event: ResizedEvent) {
    this.canvasSize.set(new Vector2d($event.newWidth, $event.newHeight));
  }

  mouseDown($event: MouseEvent): void {
    this.noDrag$.subscribe({
      // next: (event: MouseEvent) => this.addPlanet(event),
      error: (error) => console.error('error while no dragging', error),
      complete: () => console.log('end click'),
    });

    this.drag$.subscribe({
      next: ({ end }) => {
        const svgCoordinate: Vector2d = this.toSVGCoordinates(end);
        this.sunToMouseSpring.updateSpringEnd(svgCoordinate);
      },
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

  startSim(): void {
    this.running.set(true);
  }

  stopSim(): void {
    this.running.set(false);
  }

  toggleSim(): void {
    this.running.update((running) => !running);
  }

  private gameLoop(lastFrameTime?: number): void | null {
    requestAnimationFrame((time) => {
      if (!this.running()) {
        return;
      }
      const deltaTime: number = lastFrameTime ? (time - lastFrameTime) / 1000 : 1 / 120;
      this.worldService.calcNextTick(deltaTime);
      this.updatePlanets();
      this.gameLoop(time);
    });
  }

  reset(): void {
    this.stopSim();
    this.worldService.removeAll();

    const initialSetting = {
      gravitationalConstant: GravityWorldComponent.INITIAL_GRAVITY_CONSTANT,
      massOfSun: GravityWorldComponent.INITIAL_MASS_OF_SUN,
    };
    this.form.setValue(initialSetting);

    this.initializeSunAndPlanets();
    this.initializeDragSunToMouseSpring();
  }

  private toSVGCoordinates(end: Vector2d): Vector2d {
    // get coordiantes in svg space
    const svgWorld: SVGSVGElement = this.svgWorld.nativeElement;
    const pt: SVGPoint = svgWorld.createSVGPoint();
    pt.x = end.x;
    pt.y = end.y;
    const screenCTM: DOMMatrix | null = svgWorld.getScreenCTM();
    if (!screenCTM) {
      throw new Error('screenCTM is null');
    }
    const endInSVGCoords: SVGPoint = pt.matrixTransform(screenCTM.inverse());
    return new Vector2d(endInSVGCoords.x, endInSVGCoords.y);
  }

  private initializeDragSunToMouseSpring(): void {
    this.sunToMouseSpring = new SpringForce(this.sun, this.sun.mass);
    this.worldService.addForceObject(this.sunToMouseSpring);
  }
}
