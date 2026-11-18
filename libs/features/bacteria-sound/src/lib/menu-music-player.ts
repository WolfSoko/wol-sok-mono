import {
  fadeIn,
  fadeOutAndRelease,
  feedbackEcho,
  oscillator,
  SoundtrackPlayer,
} from './audio-nodes';
import { midiToHz } from './level-music';
import { composeMenuMusic, MenuNote, MENU_STEP_SEC } from './menu-music';
import { byStep, StepScheduler } from './step-scheduler';

/** Loudness of each voice at full velocity. */
const VOLUME = { pad: 0.022, bass: 0.055, bell: 0.06, breath: 0.014 } as const;

/**
 * Plays the menu music on a Web Audio context - see `menu-music.ts` for
 * what it is made of.
 *
 * The pads breathe through a low-pass filter that a slow oscillator opens
 * and closes over about twenty seconds, the bells ring through a dark,
 * feeding-back echo, and every pass of the chords gets freshly composed
 * bells. There is nothing here that reacts to the game: the menu is for
 * resting.
 */
export class MenuMusicPlayer implements SoundtrackPlayer {
  private readonly scheduler: StepScheduler;
  private readonly bus: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly lfo: OscillatorNode;
  /** The bell's spectrum: a sine with two fading overtones. */
  private readonly bell: PeriodicWave;
  private readonly nodes: AudioNode[] = [];
  private notesByStep: MenuNote[][];
  private pass = 0;

  public constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly seed: number,
    private readonly noise: () => AudioBuffer,
    /** False while nobody would hear it - the notes are then skipped. */
    private readonly audible: () => boolean
  ) {
    this.notesByStep = this.compose(seed);
    this.scheduler = new StepScheduler(context, {
      steps: this.notesByStep.length,
      stepSec: MENU_STEP_SEC,
      play: (step, at) => this.playStep(step, at),
      wrap: () => this.nextPass(),
    });

    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(destination);
    // A dotted-eighth echo, darkened a little on every repeat.
    this.nodes.push(
      ...feedbackEcho(context, this.bus, destination, {
        delaySec: MENU_STEP_SEC * 6,
        feedback: 0.42,
        wet: 0.45,
        darkenHz: 2200,
      })
    );

    // The pads behind a filter that slowly breathes open and shut.
    this.padFilter = context.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.7;
    this.padFilter.connect(this.bus);
    const sweep = context.createGain();
    sweep.gain.value = 500;
    sweep.connect(this.padFilter.frequency);
    this.lfo = context.createOscillator();
    this.lfo.frequency.value = 0.045;
    this.lfo.connect(sweep);
    this.lfo.start();
    this.nodes.push(this.padFilter, sweep);

    this.bell = context.createPeriodicWave(
      new Float32Array([0, 0, 0, 0]),
      new Float32Array([0, 1, 0.3, 0.08])
    );
  }

  /** Fades the music in, from the top of the chords. */
  public start(): void {
    fadeIn(this.context, this.bus, 0.8);
    this.scheduler.start(0);
  }

  public stop(): void {
    this.scheduler.stop();
    fadeOutAndRelease(this.context, this.bus, this.nodes, 0.4, 4000, () =>
      this.lfo.stop()
    );
  }

  /** The menu does not listen to the game. */
  public excite(): void {
    // Nothing to heat up.
  }

  /** One pass of the music, sorted by the sixteenth each note falls on. */
  private compose(seed: number): MenuNote[][] {
    const score = composeMenuMusic(seed);
    return byStep(score.steps, score.notes);
  }

  /** Fresh bells for the next pass of the chords. */
  private nextPass(): void {
    this.pass++;
    this.notesByStep = this.compose(this.seed + this.pass);
  }

  private playStep(step: number, at: number): void {
    if (!this.audible()) {
      // Muted: keep time, but build no audio nodes nobody would hear.
      return;
    }
    const notes = this.notesByStep[step];
    const pads = notes.filter((note) => note.voice === 'pad');
    if (pads.length > 0) {
      this.playPads(pads, at);
    }
    for (const note of notes) {
      if (note.voice === 'bass') {
        this.playBass(note, at);
      } else if (note.voice === 'bell') {
        this.playBell(note, at);
      } else if (note.voice === 'breath') {
        this.playBreath(note, at);
      }
    }
  }

  /**
   * The chord's pad: two triangles a few cents apart per note, over a sine
   * an octave down, all swelling in and out on one envelope.
   */
  private playPads(notes: MenuNote[], at: number): void {
    const context = this.context;
    const duration = notes[0].steps * MENU_STEP_SEC;
    const stopAt = at + duration + 1.8;
    const envelope = this.swell(at, duration, VOLUME.pad, 1.8, 1.2, 1.6);
    envelope.connect(this.padFilter);
    const sub = context.createGain();
    sub.gain.value = 0.5;
    sub.connect(envelope);
    for (const note of notes) {
      const hz = midiToHz(note.midi);
      for (const detune of [-7, 7]) {
        oscillator(context, {
          type: 'triangle',
          hz,
          detune,
          into: envelope,
          at,
          stopAt,
        });
      }
      oscillator(context, { hz: hz / 2, into: sub, at, stopAt });
    }
  }

  /** A sine an octave under the pad, rising slowly. */
  private playBass(note: MenuNote, at: number): void {
    const duration = note.steps * MENU_STEP_SEC;
    const envelope = this.swell(
      at,
      duration,
      VOLUME.bass * note.velocity,
      0.7,
      0.8,
      0.6
    );
    envelope.connect(this.bus);
    oscillator(this.context, {
      hz: midiToHz(note.midi),
      into: envelope,
      at,
      stopAt: at + duration + 0.8,
    });
  }

  /** A bell, struck and left to ring. */
  private playBell(note: MenuNote, at: number): void {
    const context = this.context;
    const ring = note.steps * MENU_STEP_SEC;
    const peak = VOLUME.bell * note.velocity;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    gain.gain.setTargetAtTime(0.0001, at + 0.02, ring / 4);
    gain.connect(this.pan(note.pan));
    oscillator(context, {
      wave: this.bell,
      hz: midiToHz(note.midi),
      into: gain,
      at,
      stopAt: at + ring + 0.5,
    });
  }

  /** Filtered noise swelling in and out, like a tide heard from afar. */
  private playBreath(note: MenuNote, at: number): void {
    const context = this.context;
    const duration = note.steps * MENU_STEP_SEC;
    const peak = VOLUME.breath * note.velocity;
    const source = context.createBufferSource();
    source.buffer = this.noise();
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    const hz = midiToHz(note.midi);
    filter.frequency.setValueAtTime(hz, at);
    filter.frequency.exponentialRampToValueAtTime(hz * 1.6, at + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + duration * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.pan(note.pan));
    source.start(at);
    source.stop(at + duration + 0.05);
  }

  /**
   * An envelope that swells to `peak` over `attack` seconds, holds until
   * `hold` seconds before the end and dies away `tail` seconds after it.
   */
  private swell(
    at: number,
    duration: number,
    peak: number,
    attack: number,
    hold: number,
    tail: number
  ): GainNode {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + duration - hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration + tail);
    return gain;
  }

  /**
   * A node that puts what plays through it at that spot in the stereo
   * field - or the bus itself where the browser cannot pan.
   */
  private pan(position: number): AudioNode {
    const context = this.context;
    if (typeof context.createStereoPanner !== 'function') {
      return this.bus;
    }
    const panner = context.createStereoPanner();
    panner.pan.value = position;
    panner.connect(this.bus);
    return panner;
  }
}
