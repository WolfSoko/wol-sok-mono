import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { BoostPadComponent } from '../boost-pad/boost-pad.component';
import { ColonyStats } from '../colony-stats';
import { JoystickComponent } from '../joystick/joystick.component';
import { SteeringVector } from '@wolsok/feat-shared-bacteria-engine';
import { WeaponPadComponent } from '../weapon-pad/weapon-pad.component';

/** A push of a player's joystick. */
export interface SeatSteering {
  playerId: number;
  vector: SteeringVector;
}

/**
 * The seats of the human players over the arena: per player a joystick zone
 * over their side and their boost pad (with the weapon, if they carry one)
 * pinned to their corner, turned towards them. Its elements take their
 * places in the stage's grid, so the host lays out no box of its own.
 */
@Component({
  selector: 'feat-lazy-bac-game-touch-pads',
  imports: [JoystickComponent, BoostPadComponent, WeaponPadComponent],
  templateUrl: './touch-pads.component.html',
  styleUrl: './touch-pads.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.solo]': 'colonies().length < 2' },
})
export class TouchPadsComponent {
  /** The colonies a finger may steer - one seat each. */
  public readonly colonies = input.required<ColonyStats[]>();
  /** True while no match runs: the pads are there, but do nothing. */
  public readonly disabled = input(false);
  /** True once the match is over. */
  public readonly over = input(false);
  /** True while the camera follows a player, which the sticks zoom. */
  public readonly zooms = input(false);
  /** True while a menu screen lies over the seats, out of reach. */
  public readonly outOfReach = input(false);

  public readonly steer = output<SeatSteering>();
  public readonly boost = output<number>();
  public readonly fire = output<number>();
  /** A pinch on a stick zone, by its factor. */
  public readonly zoom = output<number>();
  /** The wheel turned over a stick zone. */
  public readonly zoomWheel = output<WheelEvent>();
}
