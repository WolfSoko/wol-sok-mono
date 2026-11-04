import { inject, Injectable } from '@angular/core';
import { StageBusy } from '../busy/stage-busy';
import { humanForBoostKey, humanForWeaponKey } from '../colony-stats';
import { SteeringVector } from '../state/geometry';
import { GameStateService } from '../state/game-state.service';
import { GameState, GameStateStore } from '../state/game.states';
import { PlayerService } from '../state/player.service';
import { clientPoint, nearestFreeCrosshair, Pinch } from '../touch-controls';
import { ArenaStage } from './arena-stage';
import { StageFrame } from './stage-frame';
import { StageFullscreen } from './stage-fullscreen';

/**
 * What the players do on the stage - fingers and the mouse on the arena,
 * the wheel, the keys and the touch pads - turned into the game's input.
 * Provided by the stage component, whose host listeners hand it the
 * document's keys.
 */
@Injectable()
export class StageInput {
  private readonly stage = inject(ArenaStage);
  private readonly frame = inject(StageFrame);
  private readonly fullscreen = inject(StageFullscreen);
  private readonly store = inject(GameStateStore);
  private readonly gameStateService = inject(GameStateService);
  private readonly playerService = inject(PlayerService);
  private readonly busy = inject(StageBusy);

  /** Which crosshair each active pointer is dragging: pointerId -> playerId. */
  private readonly draggedBy = new Map<number, number>();
  /** The fingers on the arena, two of which may pinch the camera. */
  private readonly pinch = new Pinch();

  /**
   * Takes a key pressed anywhere in the document, and tells whether it was
   * an Escape the stage should answer - pause a match, back out of a
   * screen, and only from the main menu leave fullscreen for the page. The
   * browser takes its own fullscreen off on Escape before this runs.
   */
  public keyDown(event: KeyboardEvent): boolean {
    // Nor while a tap's work waits to run: Escape would back out of the
    // screen it belongs to, as the busy veil keeps a tap from doing.
    if (isTypingTarget(event.target) || this.busy.active()) {
      return false;
    }
    // F is handled here rather than in the store: the fullscreen request has
    // to happen inside the key event, browsers reject it otherwise.
    if (event.key.toLowerCase() === 'f' && !event.repeat) {
      this.fullscreen.set(!this.fullscreen.fullscreen());
      return false;
    }
    if (event.key === 'Escape') {
      return true;
    }
    // The boost and weapon keys belong to the game only while a match is
    // on, and never while a button has the focus: a keyboard user pressing
    // Enter on "Reset" expects a reset, not a boost. Outside of a match
    // Space still scrolls. A weapon key counts only for a human who carries
    // a weapon; anyone else's E or Shift does what it did before.
    const inMatch =
      this.store.snapshot().currentState === GameState.RUNNING &&
      !isInteractiveTarget(event.target);
    const humans = this.stage.humans();
    const boosted = inMatch ? humanForBoostKey(humans, event.key) : null;
    if (boosted != null) {
      // Space would scroll the page.
      event.preventDefault();
      if (!event.repeat) {
        this.boost(boosted.id);
      }
      return false;
    }
    const armed = inMatch
      ? humanForWeaponKey(humans, event.key, event.code)
      : null;
    if (armed != null) {
      event.preventDefault();
      if (!event.repeat) {
        this.fireWeapon(armed.id);
      }
      return false;
    }
    this.gameStateService.addKeyPress(event.key);
    return false;
  }

  /** Takes a key let go of anywhere in the document. */
  public keyUp(event: KeyboardEvent): void {
    this.gameStateService.removeKeyPress(event.key);
  }

  /**
   * The wheel zooms the camera over a big map, in or out - during a match
   * of one human; otherwise it shows the whole map and the wheel scrolls
   * the page.
   */
  public wheel(event: WheelEvent): void {
    if (!this.frame.zooms()) {
      return;
    }
    event.preventDefault();
    // In pixels: Firefox counts a mouse wheel's notches in lines.
    const perUnit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? 400
          : 1;
    this.frame.zoomBy(Math.exp((-event.deltaY * perUnit) / 500));
  }

  /** Zooms the camera by a pinch on a joystick zone. */
  public zoomBy(factor: number): void {
    this.frame.zoomBy(factor);
  }

  /**
   * Grabs the crosshair nearest to the touch and starts dragging it.
   *
   * Two pointers can be active at once, one per player, so both can play on the
   * same screen. A second finger with no crosshair left to grab pinches the
   * camera over a big map with the first, which lets go of its crosshair.
   */
  public pointerDown(event: PointerEvent): void {
    const point = this.stage.arenaPoint(event);
    if (point == null) {
      return;
    }
    const playerId = nearestFreeCrosshair(
      this.stage.humans(),
      point,
      new Set(this.draggedBy.values())
    );
    if (playerId == null) {
      if (
        this.frame.zooms() &&
        this.pinch.start(event.pointerId, clientPoint(event))
      ) {
        this.draggedBy.clear();
        (event.target as Element).setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
      return;
    }
    this.draggedBy.set(event.pointerId, playerId);
    this.pinch.down(event.pointerId, clientPoint(event));
    // Keep receiving moves once the finger slides off the canvas.
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  public pointerMove(event: PointerEvent): void {
    const factor = this.pinch.move(event.pointerId, clientPoint(event));
    if (this.pinch.pinches(event.pointerId)) {
      this.frame.zoomBy(factor);
      event.preventDefault();
      return;
    }
    const playerId = this.draggedBy.get(event.pointerId);
    if (playerId == null) {
      return;
    }
    const point = this.stage.arenaPoint(event);
    if (point == null) {
      return;
    }
    this.playerService.setDragTarget(playerId, point.x, point.y);
    event.preventDefault();
  }

  /**
   * Releases the crosshair so another finger can grab it. The target itself
   * stays, so the crosshair finishes travelling to where the finger left it.
   */
  public pointerUp(event: PointerEvent): void {
    this.draggedBy.delete(event.pointerId);
    this.pinch.up(event.pointerId);
  }

  /** Fires a player's boost - the button equivalent of Space / Enter. */
  public boost(playerId: number): void {
    this.gameStateService.boost(playerId);
  }

  /** Fires a player's weapon - the button next to the boost. */
  public fireWeapon(playerId: number): void {
    this.gameStateService.fireWeapon(playerId);
  }

  /** Pushes or releases a player's on-screen joystick. */
  public steer(playerId: number, vector: SteeringVector): void {
    this.playerService.setSteering(playerId, vector);
  }
}

/**
 * True while the key went to a control rather than to the game.
 *
 * Anything inside an overlay counts too: the level picker is a combobox whose
 * panel lives in the CDK overlay container, and typing a level name there must
 * not throw the page into fullscreen.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  return (
    element.isContentEditable ||
    element.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], .cdk-overlay-container'
    ) != null
  );
}

/**
 * True while the key went to a focused control that Space or Enter activates,
 * such as a button or a toggle. A disabled control cannot be activated, so a
 * key pressed on it still belongs to the game - the Start button keeps the
 * focus after it kicked off the match and gets disabled.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (element == null || typeof element.closest !== 'function') {
    return false;
  }
  const control = element.closest<HTMLElement>(
    'button, a[href], [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"]'
  );
  if (control == null) {
    return false;
  }
  return !(
    (control as HTMLButtonElement).disabled ||
    control.getAttribute('aria-disabled') === 'true'
  );
}
