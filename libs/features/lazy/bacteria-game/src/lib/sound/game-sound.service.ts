import { Injectable } from '@angular/core';
import { FrameEvents } from '../state/player.service';
import { MedalTier, medalRank } from '../state/medallions';
import { degreeToMidi, LevelMusic, levelMusic, midiToHz } from './level-music';
import { MenuMusicPlayer } from './menu-music-player';
import { MusicPlayer } from './music-player';

/** How a match ended, from the point of view of the people at the screen. */
export type MatchResult = 'win' | 'loss' | 'draw';

/** What plays underneath: a level's music, the menu's, or nothing. */
export type Soundtrack = LevelMusic | 'menu';

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  /** Pitch the tone glides to over its duration. */
  slideTo?: number;
  /** Seconds from now until the tone starts. */
  delay?: number;
  /** Seconds the tone takes to reach full volume. */
  attack?: number;
  /** A low-pass filter over the tone, by its cutoff in Hz. */
  lowpass?: number;
}

interface NoiseOptions {
  volume?: number;
  filter?: BiquadFilterType;
  frequency?: number;
  /** Filter frequency the burst sweeps to over its duration. */
  sweepTo?: number;
  delay?: number;
  attack?: number;
}

/** Seconds between the notes of the end-of-match jingle. */
const JINGLE_STEP_SEC = 0.14;
/** How long the jingle's last note rings. */
const JINGLE_LAST_NOTE_SEC = 0.5;

/** Captures are heard at most this often, or a fight would be one long hiss. */
const CAPTURE_INTERVAL_SEC = 0.07;
/** Pellets eaten this close together climb a ladder of notes. */
const PELLET_STREAK_SEC = 1.2;
/** The ladder the pellets climb, as scale degrees above the level's root. */
const PELLET_LADDER = [0, 2, 4, 7, 9, 11, 14, 16, 18];
/** The slider's preview tick plays at most this often. */
const PREVIEW_INTERVAL_SEC = 0.12;

/** The seed of the menu music - the player varies it with every pass. */
const MENU_MUSIC_SEED = 2024;

/**
 * The game's sound, synthesised with the Web Audio API - there are no sound
 * files to load. Everything is short and quiet: a blip for a pellet that
 * climbs a ladder with every pellet in a row, a crackle while colonies eat
 * each other, a whoosh and a thump for a boost, a warning beep and a thud
 * for the gates, a jingle in the level's key at the end - and underneath,
 * each level's own music, composed on the fly (see `MusicPlayer`), or the
 * menu's ambient piece between matches (`MenuMusicPlayer`).
 *
 * Music and effects run on buses of their own, each with a switch and a
 * volume, under a master switch and a compressor that keeps a busy fight
 * from clipping.
 *
 * Browsers only let a page make sound after a gesture, so the service
 * listens for the gestures that count - a lifted finger or mouse button, a
 * key - and creates or wakes its audio context on each one. Nothing else in
 * the game has to remember to unlock it. Without the Web Audio API every
 * call is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class GameSoundService {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private player: MusicPlayer | MenuMusicPlayer | null = null;
  /** The music asked for - also before there is a context to play it in. */
  private music: Soundtrack | null = null;
  /**
   * Where that music was to start, and when it was asked for (in ms of
   * `performance.now()`) - to start it at the right point once it can play.
   */
  private musicStart = { atSec: 0, askedAtMs: 0 };
  /** True while the audio is held because the page is hidden. */
  private suspendedWhileHidden = false;
  private enabled = true;
  private musicEnabled = true;
  private effectsEnabled = true;
  /** Volumes from 0 to 1, as the player set them. */
  private musicVolume = 1;
  private effectsVolume = 1;
  private lastCaptureAt = -Infinity;
  private lastPelletAt = -Infinity;
  private pelletStreak = 0;
  private lastPreviewAt = -Infinity;

  public constructor() {
    if (typeof document !== 'undefined') {
      // Capture phase: the context is up before any handler of the same
      // gesture wants to play a sound.
      const unlock = () => this.unlock();
      document.addEventListener('pointerup', unlock, { capture: true });
      document.addEventListener('keydown', unlock, { capture: true });
      // A hidden page stops drawing frames, so the match stands still. The
      // music holds with it - it would stutter anyway, as browsers throttle
      // the timers of a hidden page - and stays in step with moving maps.
      document.addEventListener('visibilitychange', () =>
        this.followVisibility(document.hidden)
      );
    }
  }

  /** Mutes or unmutes everything, the music included. */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.steer(this.master, enabled ? 1 : 0, 0.02);
  }

  /** Mutes or unmutes the music alone, the sound effects play on. */
  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.applyMusicLevel();
  }

  /** Mutes or unmutes the sound effects alone, the music plays on. */
  public setEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled = enabled;
    this.applyEffectsLevel();
  }

  /** How loud the music plays, from 0 to 1. */
  public setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    this.applyMusicLevel();
  }

  /** How loud the sound effects play, from 0 to 1. */
  public setEffectsVolume(volume: number): void {
    this.effectsVolume = clampVolume(volume);
    this.applyEffectsLevel();
  }

  private applyMusicLevel(): void {
    this.steer(
      this.musicBus,
      this.musicEnabled ? perceived(this.musicVolume) : 0,
      0.1
    );
  }

  private applyEffectsLevel(): void {
    this.steer(
      this.effectsBus,
      this.effectsEnabled ? perceived(this.effectsVolume) : 0,
      0.05
    );
  }

  private steer(bus: GainNode | null, level: number, seconds: number): void {
    if (bus != null && this.context != null) {
      bus.gain.setTargetAtTime(level, this.context.currentTime, seconds);
    }
  }

  /** Creates or wakes the audio context, on a user gesture. */
  private unlock(): void {
    if (this.context == null) {
      const AudioContextClass =
        typeof window === 'undefined'
          ? undefined
          : (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext);
      if (AudioContextClass == null) {
        return;
      }
      const context = new AudioContextClass();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      // A gentle compressor: a dozen effects over the music stay clear
      // instead of clipping.
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.2;
      this.master.connect(compressor);
      compressor.connect(context.destination);
      this.musicBus = context.createGain();
      this.musicBus.gain.value = this.musicEnabled
        ? perceived(this.musicVolume)
        : 0;
      this.musicBus.connect(this.master);
      this.effectsBus = context.createGain();
      this.effectsBus.gain.value = this.effectsEnabled
        ? perceived(this.effectsVolume)
        : 0;
      this.effectsBus.connect(this.master);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    if (this.player == null && this.music != null) {
      // The music was asked for before there was a context to play it in;
      // the match has gone on since.
      const music = this.music;
      const { atSec, askedAtMs } = this.musicStart;
      this.music = null;
      this.setMusic(music, atSec + (performance.now() - askedAtMs) / 1000);
    }
  }

  private followVisibility(hidden: boolean): void {
    const context = this.context;
    if (context == null) {
      return;
    }
    if (hidden && context.state === 'running') {
      this.suspendedWhileHidden = true;
      void context.suspend();
    } else if (!hidden && this.suspendedWhileHidden) {
      this.suspendedWhileHidden = false;
      void context.resume();
    }
  }

  /**
   * Reacts to what happened in a frame: boosts, pellets, captures, crushed
   * bacteria and the gates.
   */
  public frame(events: FrameEvents): void {
    // The music heats up with the fighting whether or not the effects play.
    if (events.captures > 0 && this.player instanceof MusicPlayer) {
      this.player.excite(Math.min(0.08, events.captures * 0.004));
    }
    if (!this.audible()) {
      return;
    }
    for (const isBot of events.boosts) {
      this.boost(isBot);
    }
    if (events.pelletsEaten > 0) {
      this.pellet();
    }
    if (events.captures > 0) {
      this.captures(events.captures);
    }
    if (events.gatesWarned > 0) {
      // Two soft beeps, a fifth apart - a warning, not an alarm.
      this.tone(660, 0.09, { type: 'triangle', volume: 0.07, lowpass: 2400 });
      this.tone(990, 0.12, {
        type: 'triangle',
        volume: 0.07,
        delay: 0.17,
        lowpass: 2400,
      });
    }
    if (events.gatesClosed > 0) {
      // A heavy thud with some grit, and the air it moves.
      this.tone(110, 0.3, { type: 'triangle', volume: 0.3, slideTo: 36 });
      this.tone(55, 0.45, { type: 'sine', volume: 0.25, slideTo: 30 });
      this.noise(0.2, {
        volume: 0.18,
        filter: 'lowpass',
        frequency: 900,
        sweepTo: 120,
      });
    }
    if (events.crushed > 0) {
      // A squelch, wetter the more bacteria burst.
      const volume = Math.min(0.25, 0.05 + events.crushed * 0.01);
      this.noise(0.14, {
        volume,
        filter: 'bandpass',
        frequency: 1600,
        sweepTo: 240,
      });
      this.tone(320, 0.12, {
        type: 'sine',
        volume: volume * 0.6,
        slideTo: 90,
      });
    }
  }

  /**
   * A rising arpeggio as a match starts, in the key of the level's music -
   * so it leads straight into the tune.
   */
  public matchStart(music: LevelMusic = levelMusic('petri-dish')): void {
    this.pelletStreak = 0;
    [0, 2, 4, 7].forEach((degree, step) => {
      const hz = midiToHz(degreeToMidi(music, degree) + 24);
      this.tone(hz, step === 3 ? 0.4 : 0.14, {
        type: 'triangle',
        volume: 0.12,
        delay: step * 0.09,
        lowpass: 3200,
      });
    });
    // A swell under it, like a breath taken before the start.
    this.noise(0.6, {
      volume: 0.05,
      filter: 'bandpass',
      frequency: 500,
      sweepTo: 2000,
      attack: 0.3,
    });
  }

  /**
   * A thump and a whoosh as a colony fires its boost - darker and deeper for
   * the computer's.
   */
  public boost(isBot: boolean): void {
    const base = isBot ? 130 : 200;
    this.tone(base * 0.5, 0.18, {
      type: 'sine',
      volume: 0.18,
      slideTo: base * 0.25,
    });
    this.tone(base, 0.4, {
      type: 'sawtooth',
      volume: 0.05,
      slideTo: base * 5,
      lowpass: isBot ? 1200 : 2400,
    });
    this.noise(0.4, {
      volume: 0.09,
      filter: 'bandpass',
      frequency: isBot ? 300 : 450,
      sweepTo: isBot ? 2200 : 3600,
      attack: 0.04,
    });
  }

  /** Two notes down as a match pauses. */
  public pause(): void {
    this.tone(660, 0.07, { type: 'triangle', volume: 0.07 });
    this.tone(440, 0.12, { type: 'triangle', volume: 0.07, delay: 0.09 });
  }

  /** Two notes up as it goes on. */
  public resume(): void {
    this.tone(440, 0.07, { type: 'triangle', volume: 0.07 });
    this.tone(660, 0.12, { type: 'triangle', volume: 0.07, delay: 0.09 });
  }

  /** A soft whoosh as a menu screen opens. */
  public navigate(): void {
    this.noise(0.16, {
      volume: 0.05,
      filter: 'bandpass',
      frequency: 700,
      sweepTo: 2800,
      attack: 0.03,
    });
  }

  /** A tick for a switch flipped on. */
  public tick(): void {
    this.tone(1320, 0.05, { type: 'sine', volume: 0.08, slideTo: 1760 });
  }

  /**
   * A short tick at the effects' current volume, for the slider that sets
   * it - at most a few times a second while it is dragged or stepped.
   */
  public previewEffects(): void {
    const now = this.context?.currentTime ?? 0;
    if (now - this.lastPreviewAt < PREVIEW_INTERVAL_SEC) {
      return;
    }
    this.lastPreviewAt = now;
    this.tone(880, 0.07, { type: 'triangle', volume: 0.12 });
  }

  /**
   * A short jingle for the end of a match, in the key of the level's music,
   * and the bells of the medallion it earned once the jingle has rung out.
   */
  public matchEnd(
    result: MatchResult,
    music: LevelMusic = levelMusic('petri-dish'),
    medal: MedalTier | null = null
  ): void {
    this.pelletStreak = 0;
    // Degrees of the scale, two octaves up: a climb to the octave for a
    // win, a fall below the root for a loss, a shrug for a draw.
    const degrees =
      result === 'win'
        ? [0, 2, 4, 7]
        : result === 'loss'
          ? [4, 2, 0, -3]
          : [4, 4, 2];
    const octave = result === 'loss' ? 12 : 24;
    degrees.forEach((degree, step) => {
      const last = step === degrees.length - 1;
      const hz = midiToHz(degreeToMidi(music, degree) + octave);
      this.tone(hz, last ? JINGLE_LAST_NOTE_SEC : 0.15, {
        type: result === 'loss' ? 'sawtooth' : 'triangle',
        volume: result === 'loss' ? 0.06 : 0.12,
        delay: step * JINGLE_STEP_SEC,
        lowpass: result === 'loss' ? 1400 : 3600,
      });
    });
    // The chord under the last note - the tune's final cadence.
    if (result === 'win') {
      const at = (degrees.length - 1) * JINGLE_STEP_SEC;
      for (const degree of [0, 2, 4]) {
        this.tone(midiToHz(degreeToMidi(music, degree) + 12), 1.1, {
          type: 'triangle',
          volume: 0.05,
          delay: at,
          attack: 0.15,
          lowpass: 1600,
        });
      }
    }
    if (medal != null) {
      const jingleSec =
        (degrees.length - 1) * JINGLE_STEP_SEC + JINGLE_LAST_NOTE_SEC;
      this.medalBells(medal, music, jingleSec);
    }
  }

  /**
   * Two bars of bells for a medallion, `startSec` from now, in the key of
   * the level's music - so they sound like the end of its tune. A higher
   * tier climbs higher.
   */
  private medalBells(
    tier: MedalTier,
    music: LevelMusic,
    startSec: number
  ): void {
    const degrees = [0, 2, 4, 7, 9, 11, 14].slice(0, 3 + medalRank(tier));
    // Two octaves above the bass register the root sits in.
    const notes = degrees.map((degree) =>
      midiToHz(degreeToMidi(music, degree) + 24)
    );
    notes.forEach((frequency, step) => {
      const last = step === notes.length - 1;
      const delay = startSec + step * 0.11;
      this.tone(frequency, last ? 0.8 : 0.18, {
        type: 'sine',
        volume: 0.14,
        delay,
      });
      // An overtone an octave up gives the sine a bell's shimmer.
      this.tone(frequency * 2, last ? 0.5 : 0.1, {
        type: 'sine',
        volume: 0.04,
        delay,
      });
    });
  }

  /**
   * Plays a level's music underneath the match, the menu's music, or fades
   * the music out for null. `atSec` is how far into a level's music it
   * starts, so a resumed match picks the music up where it left off.
   * Asking for the music that is already playing changes nothing.
   */
  public setMusic(music: Soundtrack | null, atSec = 0): void {
    if (music === this.music) {
      return;
    }
    this.player?.stop();
    this.player = null;
    this.music = music;
    this.musicStart = { atSec, askedAtMs: performance.now() };
    const context = this.context;
    if (music == null || context == null || this.musicBus == null) {
      return;
    }
    const noise = () => this.whiteNoise(context);
    const audible = () =>
      this.enabled && this.musicEnabled && this.musicVolume > 0;
    if (music === 'menu') {
      this.player = new MenuMusicPlayer(
        context,
        this.musicBus,
        MENU_MUSIC_SEED,
        noise,
        audible
      );
      this.player.start();
    } else {
      this.player = new MusicPlayer(
        context,
        this.musicBus,
        music,
        noise,
        audible
      );
      this.player.start(atSec);
    }
  }

  /** The key the effects are written in: the level's that is playing. */
  private key(): LevelMusic {
    return typeof this.music === 'object' && this.music != null
      ? this.music
      : levelMusic('petri-dish');
  }

  /**
   * A blip for a pellet, in key - and every pellet eaten soon after the last
   * one climbs a step higher, so a run of them becomes a little tune.
   */
  private pellet(): void {
    const now = this.context?.currentTime ?? 0;
    this.pelletStreak =
      now - this.lastPelletAt < PELLET_STREAK_SEC
        ? Math.min(PELLET_LADDER.length - 1, this.pelletStreak + 1)
        : 0;
    this.lastPelletAt = now;
    const degree = PELLET_LADDER[this.pelletStreak];
    const hz = midiToHz(degreeToMidi(this.key(), degree) + 36);
    this.tone(hz, 0.1, { type: 'sine', volume: 0.12, slideTo: hz * 1.25 });
    this.tone(hz * 2, 0.07, { type: 'sine', volume: 0.04, delay: 0.04 });
  }

  /** A crackle that gets louder the more bacteria change sides. */
  private captures(count: number): void {
    const now = this.context?.currentTime ?? 0;
    if (now - this.lastCaptureAt < CAPTURE_INTERVAL_SEC) {
      return;
    }
    this.lastCaptureAt = now;
    this.noise(0.03, {
      volume: Math.min(0.12, 0.02 + count * 0.004),
      filter: 'highpass',
      frequency: 2500 + Math.random() * 2500,
    });
  }

  private audible(): boolean {
    return (
      this.enabled &&
      this.effectsEnabled &&
      this.effectsVolume > 0 &&
      this.context != null &&
      this.effectsBus != null
    );
  }

  private tone(frequency: number, duration: number, options: ToneOptions = {}) {
    const context = this.context;
    if (!this.audible() || context == null) {
      return;
    }
    const {
      type = 'sine',
      volume = 0.1,
      slideTo,
      delay = 0,
      attack = 0.01,
      lowpass,
    } = options;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo != null) {
      oscillator.frequency.exponentialRampToValueAtTime(
        slideTo,
        start + duration
      );
    }
    const gain = this.envelope(context, start, duration, volume, attack);
    if (lowpass != null) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      oscillator.connect(filter);
      filter.connect(gain);
    } else {
      oscillator.connect(gain);
    }
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private noise(duration: number, options: NoiseOptions = {}) {
    const context = this.context;
    if (!this.audible() || context == null) {
      return;
    }
    const {
      volume = 0.1,
      filter: filterType = 'lowpass',
      frequency = 1000,
      sweepTo,
      delay = 0,
      attack = 0.01,
    } = options;
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = this.whiteNoise(context);
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, start);
    if (sweepTo != null) {
      filter.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);
    }
    source.connect(filter);
    filter.connect(this.envelope(context, start, duration, volume, attack));
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  /** A gain node on the effects bus with an attack and a smooth decay. */
  private envelope(
    context: AudioContext,
    start: number,
    duration: number,
    volume: number,
    attack: number
  ): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + Math.min(attack, duration / 2)
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.effectsBus as GainNode);
    return gain;
  }

  /** One second of white noise, made once and shared by every burst. */
  private whiteNoise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer == null) {
      const buffer = context.createBuffer(
        1,
        context.sampleRate,
        context.sampleRate
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}

function clampVolume(volume: number): number {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

/**
 * The gain for a volume from 0 to 1: squared, so the slider feels even -
 * half way sounds about half as loud, not nearly as loud as full.
 */
function perceived(volume: number): number {
  return volume * volume;
}
