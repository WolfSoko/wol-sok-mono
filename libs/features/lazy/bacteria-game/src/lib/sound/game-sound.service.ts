import { Injectable } from '@angular/core';
import { FrameEvents } from '../state/player.service';
import { LevelMusic } from './level-music';
import { MusicPlayer } from './music-player';

/** How a match ended, from the point of view of the people at the screen. */
export type MatchResult = 'win' | 'loss' | 'draw';

interface ToneOptions {
  type?: OscillatorType;
  volume?: number;
  /** Pitch the tone glides to over its duration. */
  slideTo?: number;
  /** Seconds from now until the tone starts. */
  delay?: number;
}

interface NoiseOptions {
  volume?: number;
  filter?: BiquadFilterType;
  frequency?: number;
  /** Filter frequency the burst sweeps to over its duration. */
  sweepTo?: number;
  delay?: number;
}

/** Captures are heard at most this often, or a fight would be one long hiss. */
const CAPTURE_INTERVAL_SEC = 0.07;

/**
 * The game's sound, synthesised with the Web Audio API - there are no sound
 * files to load. Everything is short and quiet: a blip for a pellet, a
 * crackle while colonies eat each other, a whoosh for a boost, a warning
 * beep and a thud for the gates, a jingle at the end - and each level's own
 * music underneath, composed on the fly (see `MusicPlayer`).
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
  private noiseBuffer: AudioBuffer | null = null;
  private musicBus: GainNode | null = null;
  private player: MusicPlayer | null = null;
  /** The music asked for - also before there is a context to play it in. */
  private music: LevelMusic | null = null;
  private enabled = true;
  private musicEnabled = true;
  private lastCaptureAt = -Infinity;

  public constructor() {
    if (typeof document !== 'undefined') {
      // Capture phase: the context is up before any handler of the same
      // gesture wants to play a sound.
      const unlock = () => this.unlock();
      document.addEventListener('pointerup', unlock, { capture: true });
      document.addEventListener('keydown', unlock, { capture: true });
    }
  }

  /** Mutes or unmutes the music alone, the sound effects play on. */
  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicBus != null && this.context != null) {
      this.musicBus.gain.setTargetAtTime(
        enabled ? 1 : 0,
        this.context.currentTime,
        0.1
      );
    }
  }

  /** Mutes or unmutes everything, the music included. */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master != null && this.context != null) {
      this.master.gain.setTargetAtTime(
        enabled ? 1 : 0,
        this.context.currentTime,
        0.02
      );
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
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 1 : 0;
      this.master.connect(this.context.destination);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.musicEnabled ? 1 : 0;
      this.musicBus.connect(this.master);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    if (this.player == null && this.music != null) {
      // The music was asked for before there was a context to play it in.
      const music = this.music;
      this.music = null;
      this.setMusic(music);
    }
  }

  /**
   * Reacts to what happened in a frame: boosts, pellets, captures, crushed
   * bacteria and the gates.
   */
  public frame(events: FrameEvents): void {
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
      this.player?.excite(Math.min(0.08, events.captures * 0.004));
    }
    if (events.gatesWarned > 0) {
      this.tone(880, 0.08, { type: 'square', volume: 0.05 });
      this.tone(880, 0.08, { type: 'square', volume: 0.05, delay: 0.16 });
    }
    if (events.gatesClosed > 0) {
      this.tone(90, 0.25, { type: 'triangle', volume: 0.25, slideTo: 40 });
      this.noise(0.15, { volume: 0.15, filter: 'lowpass', frequency: 600 });
    }
    if (events.crushed > 0) {
      this.noise(0.12, {
        volume: Math.min(0.25, 0.05 + events.crushed * 0.01),
        filter: 'bandpass',
        frequency: 1400,
        sweepTo: 300,
      });
    }
  }

  /** A rising arpeggio as a match starts. */
  public matchStart(): void {
    [262, 330, 392, 523].forEach((frequency, step) =>
      this.tone(frequency, 0.12, {
        type: 'triangle',
        volume: 0.12,
        delay: step * 0.08,
      })
    );
  }

  /** A whoosh as a colony fires its boost - darker for the computer's. */
  public boost(isBot: boolean): void {
    const base = isBot ? 140 : 220;
    this.tone(base, 0.35, {
      type: 'sawtooth',
      volume: 0.06,
      slideTo: base * 4,
    });
    this.noise(0.35, {
      volume: 0.08,
      filter: 'bandpass',
      frequency: 400,
      sweepTo: 3000,
    });
  }

  /** A soft click for pause and resume. */
  public click(): void {
    this.tone(660, 0.04, { type: 'square', volume: 0.04 });
  }

  /** A short jingle for the end of a match. */
  public matchEnd(result: MatchResult): void {
    const notes =
      result === 'win'
        ? [523, 659, 784, 1047]
        : result === 'loss'
          ? [392, 330, 262, 196]
          : [392, 392, 330];
    notes.forEach((frequency, step) =>
      this.tone(frequency, step === notes.length - 1 ? 0.45 : 0.15, {
        type: result === 'loss' ? 'sawtooth' : 'triangle',
        volume: result === 'loss' ? 0.06 : 0.12,
        delay: step * 0.14,
      })
    );
  }

  /**
   * Plays a level's music underneath the match, or fades it out for null.
   * `atSec` is how far into the match it starts, so a resumed match picks
   * the music up where it left off. Asking for the music that is already
   * playing changes nothing.
   */
  public setMusic(music: LevelMusic | null, atSec = 0): void {
    if (music === this.music) {
      return;
    }
    this.player?.stop();
    this.player = null;
    this.music = music;
    const context = this.context;
    if (music == null || context == null || this.musicBus == null) {
      return;
    }
    this.player = new MusicPlayer(context, this.musicBus, music, () =>
      this.whiteNoise(context)
    );
    this.player.start(atSec);
  }

  private pellet(): void {
    this.tone(1200, 0.09, { type: 'sine', volume: 0.12, slideTo: 1800 });
    this.tone(1800, 0.07, { type: 'sine', volume: 0.06, delay: 0.05 });
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
    return this.enabled && this.context != null && this.master != null;
  }

  private tone(frequency: number, duration: number, options: ToneOptions = {}) {
    const context = this.context;
    if (!this.audible() || context == null || this.master == null) {
      return;
    }
    const { type = 'sine', volume = 0.1, slideTo, delay = 0 } = options;
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
    const gain = this.envelope(context, start, duration, volume);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private noise(duration: number, options: NoiseOptions = {}) {
    const context = this.context;
    if (!this.audible() || context == null || this.master == null) {
      return;
    }
    const {
      volume = 0.1,
      filter: filterType = 'lowpass',
      frequency = 1000,
      sweepTo,
      delay = 0,
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
    filter.connect(this.envelope(context, start, duration, volume));
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  /** A gain node on the master bus with a fast attack and a smooth decay. */
  private envelope(
    context: AudioContext,
    start: number,
    duration: number,
    volume: number
  ): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master as GainNode);
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
