import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { delta, NO_STEERING, Point, SteeringVector } from '../state/geometry';
import {
  clientPointFromElement,
  elementPointFromClient,
  knobOffset,
  steeringVector,
  Turn,
  turnBack,
  turnPoint,
} from '../touch-controls';

const CENTRE: Point = { x: 0, y: 0 };

/** Finger distance from the centre, in CSS pixels, that counts as full push. */
export const JOYSTICK_RADIUS = 44;

/**
 * A floating on-screen joystick for one player.
 *
 * The whole element is the touch zone: wherever the finger lands becomes the
 * centre of the stick, so nobody has to aim for a small base first. Dragging
 * from there reports a {@link SteeringVector}, releasing reports the zero
 * vector. Only one pointer is tracked at a time - the other player's finger
 * belongs to their own stick.
 *
 * Directions are reported in screen space. A player who sits at another edge
 * of the phone sees the arena turned, and so is their push: "away from me"
 * is, say, down on the screen, which moves the crosshair down on the screen -
 * up in their view. The vector therefore needs no mirroring for them. Only
 * the stick itself is drawn inside the zone, whose seat is turned towards
 * the player by CSS, so the knob's offset is turned back into the zone's own
 * coordinates - see {@link turn}.
 *
 * A stick that is still held when the component goes away - the layout is
 * left with F or Escape while a finger is down - lets go first, so the
 * crosshair does not keep moving on a stick nobody can release any more.
 */
@Component({
  selector: 'feat-lazy-bac-game-joystick',
  templateUrl: './joystick.component.html',
  styleUrl: './joystick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.disabled]': 'disabled()',
    '[style.--joystick-color]': 'color()',
    '[attr.aria-label]': '"Joystick " + label()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(lostpointercapture)': 'onPointerUp($event)',
    '(window:resize)': 'onResize()',
  },
})
export class JoystickComponent implements OnDestroy {
  /** CSS colour of the player, for the ring and the knob. */
  public readonly color = input.required<string>();
  /** The player's name, shown in the zone while the stick is at rest. */
  public readonly label = input('');
  /** How far the zone is turned on the screen, clockwise, by its seat. */
  public readonly turn = input<Turn>(0);
  /** True while nobody is playing - the stick then ignores every touch. */
  public readonly disabled = input(false);

  /** Where the stick is pushed; the zero vector once it is released. */
  public readonly steer = output<SteeringVector>();

  protected readonly radius = JOYSTICK_RADIUS;
  /** The centre of the stick in element pixels, null while nobody holds it. */
  protected readonly origin = signal<Point | null>(null);
  /** The knob's offset from the centre in element pixels. */
  protected readonly knob = signal<Point>({ x: 0, y: 0 });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private pointerId: number | null = null;
  /** Where the finger landed in client pixels - every move is relative to it. */
  private originClient: Point = { x: 0, y: 0 };

  protected onPointerDown(event: PointerEvent): void {
    // A right or middle mouse button would open a menu that swallows the
    // matching pointerup, and the stick would never be let go of.
    if (this.disabled() || this.pointerId != null || event.button !== 0) {
      return;
    }
    this.pointerId = event.pointerId;
    this.originClient = { x: event.clientX, y: event.clientY };
    // The only layout read of a drag: moves are measured from the client
    // position of the touch-down, not from the element's box.
    const bounds = this.host.nativeElement.getBoundingClientRect();
    this.origin.set(
      elementPointFromClient(this.originClient, bounds, this.turn())
    );
    // Keep receiving moves once the finger slides out of the zone.
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const origin = this.origin();
    if (origin == null || event.pointerId !== this.pointerId) {
      return;
    }
    const push = delta(this.originClient, {
      x: event.clientX,
      y: event.clientY,
    });
    this.knob.set(
      knobOffset(CENTRE, turnPoint(push, turnBack(this.turn())), this.radius)
    );
    this.steer.emit(steeringVector(CENTRE, push, this.radius));
    event.preventDefault();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.release();
  }

  /**
   * The viewport moved under a held finger - the browser went fullscreen or
   * the phone turned on the other player's gesture. The finger has not moved
   * in the zone, so the client position of the centre is read again rather
   * than letting the shift count as a push.
   */
  protected onResize(): void {
    const origin = this.origin();
    if (origin == null) {
      return;
    }
    const bounds = this.host.nativeElement.getBoundingClientRect();
    this.originClient = clientPointFromElement(origin, bounds, this.turn());
  }

  public ngOnDestroy(): void {
    if (this.pointerId != null) {
      this.release();
    }
  }

  /** Lets go of the stick: the crosshair stops where it is. */
  private release(): void {
    this.pointerId = null;
    this.origin.set(null);
    this.knob.set({ x: 0, y: 0 });
    this.steer.emit(NO_STEERING);
  }
}
