/**
 * The player's sound settings as the sound reads them - each read like a
 * signal, so a switch just flipped is heard at once. The volumes are
 * fractions from 0 (silent) to 1 (full).
 */
export interface SoundSettings {
  /** The master switch: no sound at all while it is off. */
  sound(): boolean;
  music(): boolean;
  musicVolume(): number;
  effects(): boolean;
  effectsVolume(): number;
}
