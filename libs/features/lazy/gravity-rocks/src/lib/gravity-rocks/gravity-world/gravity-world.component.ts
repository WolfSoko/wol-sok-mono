import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Inject,
  Signal,
  signal,
  TrackByFunction,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
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
import { GravityConfigComponent } from './config/gravity-config.component';
import { GravityWorldConfig, INITIAL_CONFIG } from './domain/gravity-world-config';
import { GravityWorldService } from './domain/gravity-world.service';
import { Force, SpringForce } from './domain/world-objects/force';
import { Planet } from './domain/world-objects/planet';
import { Sun } from './domain/world-objects/sun';
import { svgPathForVelocity, toSvgPath } from './domain/world-objects/toSvgPath';
import { WorldObject } from './domain/world-objects/world-object';

const SVG_VIEW_PORT_SIZE = 3000;

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
    GravityConfigComponent,
  ],
})
export class GravityWorldComponent {
  public MAX_DIM: Vector2d = Vector2d.create(SVG_VIEW_PORT_SIZE, (SVG_VIEW_PORT_SIZE / 5) * 3);

  @ViewChild('svgWorld')
  svgWorld!: ElementRef<SVGSVGElement>;

  settings: WritableSignal<GravityWorldConfig>;

  public running = signal(false);
  sun!: Sun;
  planets: WritableSignal<Planet[]> = signal([]);

  forces: WritableSignal<Force[]> = signal([]);
  forcesSvgPaths: Signal<string[]> = computed(() => this.forces().map((f) => toSvgPath(f)));

  velocitySvgPath: Signal<string[]> = computed(() =>
    this.planets().map((planet) => svgPathForVelocity(planet.pos, planet.vel))
  );

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
    @Inject(INITIAL_CONFIG) private readonly initialConfig: GravityWorldConfig
  ) {
    this.settings = signal(this.initialConfig);
    this.initializeSunAndPlanets();
    this.updateSignals();

    effect(() => {
      this.worldService.setUniverse(this.canvasSize().x, this.canvasSize().y, this.settings().gravitationalConstant);
    });
    effect(() => (this.sun.mass = this.settings().massOfSun));
    effect(() => (this.running() ? this.gameLoop() : null));
  }

  private initializeSunAndPlanets(): void {
    this.sun = new Sun(this.calcCenteredVec(), undefined, this.settings().massOfSun);

    this.worldService.addWorldObject(this.sun);

    this.worldService.addWorldObject(new Planet(this.calcCenteredVec(vec2(0, 450)), vec2(-100, 0), 1000));
    const planet2Pos: Vector2d = vec2(-300, -250);
    this.worldService.addWorldObject(
      new Planet(this.calcCenteredVec(planet2Pos), planet2Pos.orthogonalTo(this.sun.pos).mul(100), 2000)
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
