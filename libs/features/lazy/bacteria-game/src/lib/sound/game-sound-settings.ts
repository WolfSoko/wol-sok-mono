import { GameSettingsService, MAX_VOLUME } from '../settings.service';
import { type SoundSettings } from '@wolsok/feat-bacteria-sound';

/** The game's device settings, as the sound reads them. */
export function soundSettingsOf(settings: GameSettingsService): SoundSettings {
  return {
    sound: () => settings.value('sound'),
    music: () => settings.value('music'),
    musicVolume: () => settings.value('musicVolume') / MAX_VOLUME,
    effects: () => settings.value('effects'),
    effectsVolume: () => settings.value('effectsVolume') / MAX_VOLUME,
  };
}
