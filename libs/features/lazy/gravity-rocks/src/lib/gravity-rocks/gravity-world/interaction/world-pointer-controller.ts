import { Signal } from '@angular/core';
import { Vector2d } from '@wolsok/utils-math';
import { map, Observable, Subject, switchMap, take, takeUntil } from 'rxjs';
import { ClientPoint, clientPoint, WorldCamera } from '../camera/world-camera';
import { GravityWorldService } from '../domain/gravity-world.service';
import { Planet } from '../domain/world-objects/planet';
import {
  MAX_VELOCITY,
  WorldObject,
} from '../domain/world-objects/world-object';
import { OrbitTool } from '../orbit-tool/orbit-tool';
import { Tool } from '../toolbelt/tools';
import { isWithinClickTolerance, PointerTracker } from './pointer-tracker';
import { SPRING_SPEED_PER_AU, SpringForce } from './spring-force';
import { swallowNextClick } from './swallow-next-click';

const RIGHT_BUTTON = 2;

/** What a gesture on the world ends up asking for. */
export interface WorldPointerIntents {
  /** A body was pressed and let go where it was pressed. */
  tap(wo: WorldObject): void;
  /** A body asked for its settings: a right click or a long press. */
  openMenu(wo: WorldObject): void;
  /** The add tool pressed on empty space: a new body there, to drag along. */
  place(at: Vector2d): Planet;
  /** A body this gesture placed is taken back, the gesture never finished. */
  discard(planet: Planet): void;
  /** The orbit tool let a satellite go onto the orbit it drew. */
  placeSatellite(parent: WorldObject, distance: number, angle: number): void;
}

/** What the controller has to know about the world it is pointed at. */
export interface WorldPointerControllerWorld {
  camera: WorldCamera;
  orbitTool: OrbitTool;
  tool: Signal<Tool>;
  /** A running world throws through its spring; a paused one on release. */
  running: Signal<boolean>;
  objects: Pick<
    GravityWorldService,
    'worldObjects' | 'addForceObject' | 'removeForceObject' | 'refresh'
  >;
  /** The svg the pointers are on, once it is rendered. */
  svg(): SVGSVGElement | undefined;
  intents: WorldPointerIntents;
}

/**
 * Turns pointer, wheel and context-menu events on the world into what they
 * mean: a drag or a throw, a pan, a pinch, a tap, a long press.
 *
 * Owns no bodies and no selection - what a tap or a long press does is
 * handed on through `intents`.
 */
export class WorldPointerController {
  private readonly pointerDown$: Subject<PointerEvent> = new Subject();
  private readonly pointerMove$: Subject<PointerEvent> = new Subject();
  /** Emits whenever the running gesture ends, however it ends. */
  private readonly gestureEnd$: Subject<void> = new Subject();

  /** The pointers on the world, and what they went down on. */
  private readonly pointers = new PointerTracker<WorldObject>();

  /** The pointer driving the current drag, and the planet it created. */
  private dragPointerId: number | null = null;
  private createdByDrag: Planet | null = null;

  /** What the drag holds, where it started, and where it has been taken. */
  private dragObject: WorldObject | null = null;
  private dragOrigin: ClientPoint | null = null;
  private dragEnd: Vector2d | null = null;

  private readonly drag$: Observable<{ end: Vector2d }> = this.pointerDown$
    .asObservable()
    .pipe(
      take(1),
      switchMap(() =>
        this.pointerMove$.asObservable().pipe(
          map((pm: PointerEvent) => ({
            end: this.world.camera.toWorld(pm),
          })),
          takeUntil(this.gestureEnd$.asObservable())
        )
      )
    );

  public constructor(private readonly world: WorldPointerControllerWorld) {}

  /** Stops what is still pending, the long press timer. */
  public dispose(): void {
    this.pointers.cancelLongPress();
  }

  /**
   * Starts what the tool in hand does: a pan on empty space, or on a body a
   * gesture that ends in `tap` when the pointer is let go where it was
   * pressed. The grab tool also hooks a spring onto the body to drag and
   * fling it, and the add tool first puts a new body under the pointer to do
   * the same with. A second finger turns any of it into pinch zoom and pan.
   */
  public pointerDown($event: PointerEvent): void {
    if ($event.button === RIGHT_BUTTON) {
      // the right button opens the settings panel, see `contextMenu`
      return;
    }
    if (this.pointers.count >= 2) {
      // two fingers already own the gesture, a third would only confuse it
      return;
    }
    const { camera, orbitTool } = this.world;
    this.pointers.add($event.pointerId, $event);
    // keep receiving moves once the gesture wanders off the svg - the second
    // finger needs that just as much as the first
    this.world.svg()?.setPointerCapture?.($event.pointerId);
    const pair = this.pointers.pair;
    if (pair) {
      // the first finger was only ever the start of a two finger gesture
      this.cancelDrag();
      camera.startPinch(...pair);
      return;
    }
    if (this.isPanGesture($event)) {
      this.startPanning($event);
      return;
    }
    const tool: Tool = this.world.tool();
    let wo = this.findWorldObject($event.target as SVGElement);
    if (wo) {
      this.pointers.pressOn(wo, $event);
      if ($event.pointerType !== 'mouse') {
        // touch has no right button, so resting on an object opens the panel
        this.startLongPress(wo);
      }
      if (tool !== 'grab' && tool !== 'add') {
        // the other tools act on the tap, there is nothing to drag
        return;
      }
    } else if (tool === 'orbit' && orbitTool.parent()) {
      // a press beside the picked body takes hold of the drawn orbit
      orbitTool.grab($event.pointerId, camera.toWorld($event));
      return;
    } else if (tool === 'add') {
      // a click on empty space places a body, it does not move the view
      const created: Planet = this.world.intents.place(camera.toWorld($event));
      this.createdByDrag = created;
      wo = created;
    } else {
      this.startPanning($event);
      return;
    }
    this.startDrag(wo, $event);
  }

  /**
   * Ends the current pan or drag gesture, and taps the object it was on - or
   * lets a satellite go onto the orbit the pointer was holding.
   */
  public pointerUp($event: PointerEvent): void {
    const { orbitTool } = this.world;
    const heldOrbit: boolean = orbitTool.isHeldBy($event.pointerId);
    const pressed = this.endGesture($event);
    if (heldOrbit) {
      const placed = orbitTool.release(this.world.camera.toWorld($event));
      if (placed) {
        this.world.intents.placeSatellite(
          placed.parent,
          placed.orbit.radius,
          placed.orbit.angle
        );
      }
    } else if (pressed && isWithinClickTolerance(pressed.at, $event)) {
      this.world.intents.tap(pressed.subject);
    }
  }

  /** Ends the gesture without following, the system took the pointer away. */
  public pointerCancel($event: PointerEvent): void {
    // a placement the system cut short was never finished
    const created: Planet | null = this.createdByDrag;
    if (this.world.orbitTool.isHeldBy($event.pointerId)) {
      this.world.orbitTool.letGo();
    }
    this.endGesture($event);
    if (created) {
      this.world.intents.discard(created);
    }
  }

  /** Zooms and pans with two fingers, moves the view while panning, and
   * otherwise feeds the drag gesture. */
  public pointerMove($event: PointerEvent): void {
    const { camera, orbitTool } = this.world;
    this.pointers.moveTo($event.pointerId, $event);
    if (camera.isPinching) {
      const pair = this.pointers.pair;
      if (pair) {
        camera.pinchTo(...pair);
      }
      return;
    }
    if (camera.isPanning) {
      camera.panTo($event);
      return;
    }
    if (
      orbitTool.parent() &&
      this.world.tool() === 'orbit' &&
      // the pointer holding the orbit, or a mouse hovering with none pressed
      (orbitTool.isHeldBy($event.pointerId) || this.pointers.count === 0)
    ) {
      orbitTool.moveTo(camera.toWorld($event));
    }
    if (this.pointers.hasWandered($event)) {
      // the gesture has become a drag, releasing it must not center anything,
      // not even when the pointer comes back to where it started
      this.pointers.dropPress();
      this.pointers.cancelLongPress();
    }
    if (this.dragPointerId === $event.pointerId) {
      const origin: ClientPoint | null = this.dragOrigin;
      if (origin && !isWithinClickTolerance(origin, $event)) {
        // a gesture this long is a drag, and a drag can throw
        this.dragEnd = camera.toWorld($event);
      }
      this.pointerMove$.next($event);
    }
  }

  /** Zooms towards the cursor, so the world point under it stays in place. */
  public wheel($event: WheelEvent): void {
    if ($event.deltaY === 0) {
      return;
    }
    $event.preventDefault();
    this.world.camera.zoomAt($event, $event.deltaY < 0);
  }

  /** Opens the settings of the object under the cursor on a right click. */
  public contextMenu($event: MouseEvent): void {
    if (this.world.orbitTool.isHeld) {
      // a finger resting on the drawn orbit is still holding it - the
      // browser's long press must neither show its menu nor cut the gesture
      // short, the satellite follows on release as it would have
      $event.preventDefault();
      return;
    }
    const wo: WorldObject | undefined = this.findWorldObject(
      $event.target as SVGElement
    );
    if (!wo) {
      return;
    }
    $event.preventDefault();
    if (this.pointers.count > 0) {
      // a finger is still down: the browser's own long press got here before
      // ours, so let go of the body as `startLongPress` would, or lifting the
      // finger flings it - and eat the click that lift turns into
      this.cancelDrag();
      swallowNextClick();
    }
    this.openMenu(wo);
  }

  private findWorldObject(target: SVGElement): WorldObject | undefined {
    return this.world.objects.worldObjects().find((wo) => wo.id === target.id);
  }

  /** Hooks a spring onto `wo` that follows the pointer until the gesture ends. */
  private startDrag(wo: WorldObject, $event: PointerEvent): void {
    this.dragPointerId = $event.pointerId;
    this.dragObject = wo;
    this.dragOrigin = clientPoint($event);
    this.dragEnd = null;
    const springForce = new SpringForce(wo);
    this.world.objects.addForceObject(springForce);

    this.drag$.subscribe({
      next: ({ end }) => springForce.updateSpringEnd(end),

      error: (error) => {
        console.error('error while dragging', error);
        this.world.objects.removeForceObject(springForce);
      },
      complete: () => this.world.objects.removeForceObject(springForce),
    });
    this.pointerDown$.next($event);
  }

  /**
   * Unwinds everything this pointer started and reports the object it was
   * pressed on, as long as the gesture stayed within the click tolerance.
   */
  private endGesture(
    $event: PointerEvent
  ): { subject: WorldObject; at: ClientPoint } | null {
    const { camera } = this.world;
    this.pointers.remove($event.pointerId);
    const svg: SVGSVGElement | undefined = this.world.svg();
    if (svg?.hasPointerCapture?.($event.pointerId)) {
      svg.releasePointerCapture($event.pointerId);
    }
    this.pointers.cancelLongPress();
    if (camera.isPinching) {
      // the finger left over must not carry on as a drag of its own
      if (this.pointers.count < 2) {
        camera.endGesture();
      }
      return null;
    }
    const pressed = this.pointers.takePress();
    camera.endGesture();
    this.dragPointerId = null;
    this.createdByDrag = null;
    this.gestureEnd$.next();
    this.throwDragged();
    return pressed;
  }

  /**
   * Hands the dragged object the speed of the gesture that let go of it.
   * A running simulation gets that from the spring, whose acceleration works
   * out to the stretch times `SPRING_SPEED_PER_AU` - mass cancels out of
   * `-mass * stiffness * distance`. A paused world never ticks, so the same
   * stretch is turned into a velocity here instead, once, on release.
   */
  private throwDragged(): void {
    const wo: WorldObject | null = this.dragObject;
    const end: Vector2d | null = this.dragEnd;
    this.dragObject = null;
    this.dragOrigin = null;
    this.dragEnd = null;
    if (!wo || !end || wo.isStatic || this.world.running()) {
      return;
    }
    const stretch: Vector2d = end.sub(wo.pos);
    const speed: number = Math.min(
      stretch.length() * SPRING_SPEED_PER_AU,
      MAX_VELOCITY
    );
    if (speed <= 0) {
      return;
    }
    wo.vel = stretch.norm().mul(speed);
    this.world.objects.refresh();
  }

  /** Drops the running drag, taking back the planet it has just created. */
  private cancelDrag(): void {
    this.pointers.cancelLongPress();
    const created = this.createdByDrag;
    this.world.camera.endGesture();
    this.pointers.dropPress();
    this.dragPointerId = null;
    this.world.orbitTool.letGo();
    this.createdByDrag = null;
    // an abandoned gesture is not a throw
    this.dragObject = null;
    this.dragOrigin = null;
    this.dragEnd = null;
    this.gestureEnd$.next();
    if (created) {
      this.world.intents.discard(created);
    }
  }

  /** Panning is the middle mouse button, or a drag with a modifier held. */
  private isPanGesture($event: PointerEvent): boolean {
    return (
      $event.button === 1 || $event.shiftKey || $event.ctrlKey || $event.metaKey
    );
  }

  /** Starts moving the view with the pointer, rather than anything in it. */
  private startPanning($event: PointerEvent): void {
    $event.preventDefault();
    this.world.camera.startPan($event);
  }

  /** A finger resting on an object opens its settings, like a right click. */
  private startLongPress(wo: WorldObject): void {
    this.pointers.startLongPress(() => {
      // the finger is still down, so let go of the object before the panel
      // takes over - otherwise it would be flung when the finger lifts
      this.cancelDrag();
      this.openMenu(wo);
      // and it is still down now, so the click it turns into is still coming
      swallowNextClick();
    });
  }

  private openMenu(wo: WorldObject): void {
    this.pointers.cancelLongPress();
    this.world.intents.openMenu(wo);
  }
}
