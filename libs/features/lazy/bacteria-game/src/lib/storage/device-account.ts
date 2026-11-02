import { signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import type {
  GameAccount,
  PlayerProfile,
  PlayerSwitch,
  SignInOutcome,
} from './game-account';

/** The device as the only player, when the game has no cloud to sign in to. */
export class DeviceAccount implements GameAccount {
  public readonly cloud = false;
  public readonly profile = signal<PlayerProfile | null>(null).asReadonly();
  /** Nobody owns a game without a project. */
  public readonly owner = signal(false).asReadonly();
  public readonly players: Observable<PlayerSwitch> = of({
    playerId: 'device',
    adoptsGuest: false,
  });

  public signIn(): Promise<SignInOutcome> {
    return Promise.resolve('failed');
  }

  public signOut(): Promise<void> {
    return Promise.resolve();
  }
}
