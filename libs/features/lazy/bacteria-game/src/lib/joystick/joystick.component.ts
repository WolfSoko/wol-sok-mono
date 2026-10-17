import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NO_STEERING, Point, SteeringVector } from '../state/geometry';
import { knobOffset, steeringVector } from '../touch-controls';

/**
 * A floating on-screen joystick for one player.
 *
 * The whole element is the touch zone: wherever the finger lands becomes the
 * centre of the stick, so nobody has to aim for a small base first. Dragging
 * from there reports a {@link SteeringVector}, releasing reports the zero
 * vector. Only one pointer is tracked at a time - the other player's finger
 * belongs to their own stick.
 *
 * Directions are reported in screen space. A player who sits at the far edge
 * of the phone sees the arena upside down, and so is their push: "away from
 * me" is down on the screen, which moves the crosshair down on the screen -
 * up in their view. The vector therefore needs no mirroring for them.
 */
@Component({
  selector: 'feat-lazy-bac-game-joystick',
  templateUrl: './joystick.component.html',
  styleUrl: './joystick.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.flipped]': 'flipped()',
    '[class.disabled]': 'disabled()',
    '[class.active]': 'origin() != null',
    '[style.--joystick-color]': 'color()',
    '[attr.aria-label]': '"Joystick " + label()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(lostpointercapture)': 'onPointerUp($event)',
  },
})
export class JoystickComponent {
  /** CSS colour of the player, for the ring and the knob. */
  public readonly color = input.required<string>();
  /** The player's name, shown in the zone while the stick is at rest. */
  public readonly label = input('');
  /** True for the player at the far edge, whose label is turned towards them. */
  public readonly flipped = input(false);
  /** True while nobody is playing - the stick then ignores every touch. */
  public readonly disabled = input(false);
  /** Finger distance from the centre, in CSS pixels, that counts as full push. */
  public readonly radius = input(44);

  /** Where the stick is pushed; the zero vector once it is released. */
  public readonly steer = output<SteeringVector>();

  /** The centre of the stick in element pixels, null while nobody holds it. */
  protected readonly origin = signal<Point | null>(null);
  /** The knob's offset from the centre in element pixels. */
  protected readonly knob = signal<Point>({ x: 0, y: 0 });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private pointerId: number | null = null;
  /** Where the finger landed in client pixels - every move is relative to it. */
  private originClient: Point = { x: 0, y: 0 };

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled() || this.pointerId != null) {
      return;
    }
    this.pointerId = event.pointerId;
    this.originClient = { x: event.clientX, y: event.clientY };
    // The only layout read of a drag: moves are measured from the client
    // position of the touch-down, not from the element's box.
    const bounds = this.host.nativeElement.getBoundingClientRect();
    this.origin.set({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    this.knob.set({ x: 0, y: 0 });
    // Keep receiving moves once the finger slides out of the zone.
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const origin = this.origin();
    if (origin == null || event.pointerId !== this.pointerId) {
      return;
    }
    const pointer = {
      x: origin.x + event.clientX - this.originClient.x,
      y: origin.y + event.clientY - this.originClient.y,
    };
    this.knob.set(knobOffset(origin, pointer, this.radius()));
    this.steer.emit(steeringVector(origin, pointer, this.radius()));
    event.preventDefault();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.release();
  }

  /** Lets go of the stick: the crosshair stops where it is. */
  private release(): void {
    this.pointerId = null;
    this.origin.set(null);
    this.knob.set({ x: 0, y: 0 });
    this.steer.emit({ ...NO_STEERING });
  }
}
