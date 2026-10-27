import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { playerNameText, renderGameText } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import {
  add,
  clampLength,
  delta,
  NO_STEERING,
  Point,
  SteeringVector,
} from '../state/geometry';
import { Pinch, steeringVector } from '../touch-controls';

/** Finger distance from the centre, in CSS pixels, that counts as full push. */
export const JOYSTICK_RADIUS = 44;

/**
 * A floating on-screen joystick for one player.
 *
 * The whole element is the touch zone, laid over the arena: wherever the
 * finger lands becomes the centre of the stick, so nobody has to aim for a
 * small base first. Dragging from there reports a {@link SteeringVector},
 * releasing reports the zero vector. A finger pulled past the rim drags the
 * base along behind it, so the stick stays under the thumb and turning back
 * takes no long way across the screen. Only one pointer steers at a time -
 * the other player's finger belongs to their own stick.
 *
 * Where the camera can zoom, a second finger in the zone pinches it with
 * the one on the stick, as two fingers on the arena do: the stick lets go,
 * and the gesture zooms until both fingers are lifted.
 *
 * Directions are reported in screen space. A player who sits at another edge
 * of the phone sees the arena turned, and so is their push: "away from me"
 * is, say, down on the screen, which moves the crosshair down on the screen -
 * up in their view. The vector therefore needs no mirroring for them, and the
 * zone itself is never turned either - a stick looks the same from every
 * side. Only the label is turned towards the player, by the `--seat-turn`
 * custom property the stage sets on the zone.
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
    '[attr.aria-label]': 'ariaLabel()',
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
  /** True while nobody is playing - the stick then ignores every touch. */
  public readonly disabled = input(false);
  /** True while the camera can zoom: two fingers in the zone pinch it. */
  public readonly zooms = input(false);

  /** Where the stick is pushed; the zero vector once it is released. */
  public readonly steer = output<SteeringVector>();
  /** How much a pinch zooms the camera: above 1 in, below 1 out. */
  public readonly zoom = output<number>();

  private readonly i18n = inject(I18nService);

  /** The player's name in the active language - an online name as it is. */
  protected readonly name = computed(() => {
    const text = playerNameText(this.label());
    return text === null
      ? this.label()
      : renderGameText(text, (key, params) => this.i18n.t(key, params));
  });
  protected readonly ariaLabel = computed(() =>
    this.i18n.t('controls.joystick', { name: this.name() })
  );

  protected readonly radius = JOYSTICK_RADIUS;
  /** The centre of the stick in element pixels, null while nobody holds it. */
  protected readonly origin = signal<Point | null>(null);
  /** The knob's offset from the centre in element pixels. */
  protected readonly knob = signal<Point>({ x: 0, y: 0 });
  /**
   * Puts the base under the finger - a transform, so a base that trails the
   * finger costs no layout on every move.
   */
  protected readonly baseTransform = computed(() => {
    const origin = this.origin();
    return origin === null
      ? null
      : `translate(${origin.x}px, ${origin.y}px) translate(-50%, -50%)`;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private pointerId: number | null = null;
  /** The fingers in the zone, two of which may pinch the camera. */
  private readonly fingers = new Pinch();
  /** Where the finger landed in client pixels - every move is relative to it. */
  private originClient: Point = { x: 0, y: 0 };

  protected onPointerDown(event: PointerEvent): void {
    // A right or middle mouse button would open a menu that swallows the
    // matching pointerup, and the stick would never be let go of.
    if (this.disabled() || event.button !== 0) {
      return;
    }
    const finger = clientPoint(event);
    if (this.pointerId != null) {
      // A second finger pinches with the one on the stick, which lets go.
      if (this.zooms() && this.fingers.start(event.pointerId, finger)) {
        this.release();
        this.host.nativeElement.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
      return;
    }
    // A finger left over from a pinch does not take the stick.
    if (this.fingers.active()) {
      return;
    }
    this.pointerId = event.pointerId;
    this.fingers.down(event.pointerId, finger);
    this.originClient = finger;
    // The only layout read of a drag: moves are measured from the client
    // position of the touch-down, not from the element's box.
    const bounds = this.host.nativeElement.getBoundingClientRect();
    this.origin.set({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
    // Keep receiving moves once the finger slides out of the zone.
    this.host.nativeElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  protected onPointerMove(event: PointerEvent): void {
    const finger = clientPoint(event);
    const factor = this.fingers.move(event.pointerId, finger);
    if (this.fingers.pinches(event.pointerId)) {
      if (factor !== 1) {
        this.zoom.emit(factor);
      }
      event.preventDefault();
      return;
    }
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const push = delta(this.originClient, finger);
    const knob = clampLength(push, this.radius);
    // Past the rim the base follows the finger, which keeps the knob on the
    // rim: still pushed all the way, in the finger's direction.
    const trail = delta(knob, push);
    if (trail.x !== 0 || trail.y !== 0) {
      this.originClient = add(this.originClient, trail);
      this.origin.update((origin) => origin && add(origin, trail));
    }
    this.knob.set(knob);
    this.steer.emit(steeringVector(knob, this.radius));
    event.preventDefault();
  }

  protected onPointerUp(event: PointerEvent): void {
    this.fingers.up(event.pointerId);
    if (event.pointerId === this.pointerId) {
      this.release();
    }
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
    this.originClient = {
      x: bounds.left + origin.x,
      y: bounds.top + origin.y,
    };
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

function clientPoint(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY };
}
