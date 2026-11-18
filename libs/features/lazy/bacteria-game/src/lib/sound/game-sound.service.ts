import { Injectable, inject } from '@angular/core';
import { GameSound } from '@wolsok/feat-bacteria-sound';
import { GameSettingsService } from '../settings.service';
import { soundSettingsOf } from './game-sound-settings';

/** The game's one `GameSound`, following the device's sound settings. */
@Injectable({ providedIn: 'root' })
export class GameSoundService extends GameSound {
  public constructor() {
    super(soundSettingsOf(inject(GameSettingsService)));
  }
}
