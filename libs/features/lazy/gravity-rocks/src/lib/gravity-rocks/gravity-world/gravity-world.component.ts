import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Signal,
  signal,
  computed,
  ViewChild,
  WritableSignal,
  TrackByFunction,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ElemResizedDirective, LetDirective } from '@wolsok/ui-kit';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { map, Observable, Subject, switchMap, take, takeUntil } from 'rxjs';
import { GravityWorldService } from './gravity-world.service';
import { Force, SpringForce } from './world-objects/force';
import { Planet } from './world-objects/planet';
import { Sun } from './world-objects/sun';
import { WorldObject } from './world-objects/world-object';

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
    MatTooltipModule,
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

  forces: WritableSignal<Force[]> = signal([]);

  canvasSize: WritableSignal<Vector2d> = signal(this.MAX_DIM);

  private mouseDown$: Subject<MouseEvent> = new Subject();
  private mouseMove$: Subject<MouseEvent> = new Subject();
  private mouseUp$: Subject<MouseEvent> = new Subject();

  drag$: Observable<{ end: Vector2d }> = this.mouseDown$.asObservable().pipe(
    take(1),
    switchMap(() =>
      this.mouseMove$.asObservable().pipe(
        map((mm: MouseEvent) => ({ end: Vector2d.create(mm.offsetX, mm.offsetY) })),
        takeUntil(this.mouseUp$.asObservable())
      )
    )
  );

  private noDrag$: Observable<MouseEvent> = this.mouseDown$.asObservable().pipe(
    take(1),
    switchMap(() => this.mouseUp$.asObservable().pipe(takeUntil(this.mouseMove$.asObservable())))
  );
  trackByPlanet: TrackByFunction<Planet> = (index, planet) => planet.pos;

  constructor(
    readonly worldService: GravityWorldService,
    readonly nNfB: NonNullableFormBuilder
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

    this.updateSignals();

    effect(() => {
      this.worldService.setUniverse(this.canvasSize().x, this.canvasSize().y, this.settings().gravitationalConstant);
    });
    effect(() => (this.sun.mass = this.settings().massOfSun));
    effect(() => (this.running() ? this.gameLoop() : null));
  }

  private initializeSunAndPlanets(): void {
    this.sun = new Sun(this.calcCenteredVec(), undefined, GravityWorldComponent.INITIAL_MASS_OF_SUN);

    this.worldService.addWorldObject(this.sun);

    this.worldService.addWorldObject(new Planet(this.calcCenteredVec(vec2(0, 100)), vec2(-40, 0), 100));
    const planet2Pos: Vector2d = vec2(-200, -150);
    this.worldService.addWorldObject(
      new Planet(this.calcCenteredVec(planet2Pos), planet2Pos.orthogonalTo(this.sun.pos).mul(30), 200)
    );
    this.updateSignals();
  }

  private calcCenteredVec(vec: Vector2d = vec2(0, 0)): Vector2d {
    return this.canvasSize().div(2).add(vec);
  }

  private updateSignals(): void {
    this.planets.set(this.worldService.getWorldObjects().filter((wo) => wo instanceof Planet) as Array<Planet>);
    this.forces.set(this.worldService.getForces());
  }

  private findWorldObject(target: SVGElement): WorldObject | undefined {
    return this.worldService.getWorldObjects().find((wo) => wo.id === target.id);
  }

  mouseDown($event: MouseEvent): void {
    let wo = this.findWorldObject($event.target as SVGElement);
    if (!wo) {
      const pos = vec2($event.offsetX, $event.offsetY);
      wo = this.createRandomPlanetAt(pos);
      this.worldService.addWorldObject(wo);
    }
    const springForce = new SpringForce(wo);
    this.worldService.addForceObject(springForce);
    this.updateSignals();

    /*this.noDrag$.subscribe({
      next: (event: MouseEvent) => console.log('noDrag$ next', event),
      error: (error) => console.error('error while no dragging', error),
      complete: () => console.log('end noDrag$ click'),
    });*/

    this.drag$.subscribe({
      next: ({ end }) => springForce.updateSpringEnd(this.toSVGCoordinates(end)),

      error: (error) => {
        console.error('error while dragging', error);
        this.removeForce(springForce);
      },
      complete: () => this.removeForce(springForce),
    });
    this.mouseDown$.next($event);
  }

  private removeForce(springForce: SpringForce): void {
    this.worldService.removeForceObject(springForce);
    this.updateSignals();
  }

  mouseUp($event: MouseEvent): void {
    this.mouseUp$.next($event);
  }

  mouseMove($event: MouseEvent): void {
    this.mouseMove$.next($event);
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
      this.updateSignals();
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
  }

  private toSVGCoordinates({ x, y }: Vector2d): Vector2d {
    // get coordiantes in svg space
    const svgWorld: SVGSVGElement = this.svgWorld.nativeElement;
    const pt: SVGPoint = svgWorld.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const ctm: DOMMatrix | null = svgWorld.getCTM();
    if (!ctm) {
      throw new Error('ctm is null');
    }
    const endInSVGCoords: SVGPoint = pt.matrixTransform(ctm.inverse());
    return vec2(endInSVGCoords.x, endInSVGCoords.y);
  }

  private createRandomPlanetAt(pos: Vector2d): Planet {
    const planet: Planet = new Planet(this.toSVGCoordinates(pos), undefined, Math.random() * 400 + 30);
    return planet;
  }

  removePlanet(planet: Planet): void {
    this.worldService.removeWorldObject(planet);
    this.updateSignals();
  }
}
