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
export class MenuMusicPlayer {
  private readonly scheduler: StepScheduler;
  private readonly bus: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private readonly lfo: OscillatorNode;
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
    const score = composeMenuMusic(seed);
    this.notesByStep = byStep(score.steps, score.notes);
    this.scheduler = new StepScheduler(context, {
      steps: score.steps,
      stepSec: MENU_STEP_SEC,
      play: (step, at) => this.playStep(step, at),
      wrap: () => this.nextPass(),
    });

    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(destination);

    // A dotted-eighth echo, darkened a little on every repeat.
    const delay = context.createDelay(2);
    delay.delayTime.value = MENU_STEP_SEC * 6;
    const feedback = context.createGain();
    feedback.gain.value = 0.42;
    const darken = context.createBiquadFilter();
    darken.type = 'lowpass';
    darken.frequency.value = 2200;
    const wet = context.createGain();
    wet.gain.value = 0.45;
    this.bus.connect(delay);
    delay.connect(darken);
    darken.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(destination);

    // The pads behind a filter that slowly breathes open and shut.
    this.padFilter = context.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.7;
    this.padFilter.connect(this.bus);
    this.lfo = context.createOscillator();
    this.lfo.frequency.value = 0.045;
    const sweep = context.createGain();
    sweep.gain.value = 500;
    this.lfo.connect(sweep);
    sweep.connect(this.padFilter.frequency);
    this.lfo.start();

    this.nodes.push(delay, feedback, darken, wet, this.padFilter, sweep);
  }

  /** Fades the music in, from the top of the chords. */
  public start(): void {
    const now = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(1, now, 0.8);
    this.scheduler.start(0);
  }

  /** Fades the music out and lets go of its audio nodes. */
  public stop(): void {
    this.scheduler.stop();
    const now = this.context.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(0, now, 0.4);
    const nodes = [this.bus, ...this.nodes];
    const lfo = this.lfo;
    setTimeout(() => {
      lfo.stop();
      nodes.forEach((node) => node.disconnect());
    }, 4000);
  }

  /** Fresh bells for the next pass of the chords. */
  private nextPass(): void {
    this.pass++;
    const score = composeMenuMusic(this.seed + this.pass);
    this.notesByStep = byStep(score.steps, score.notes);
  }

  private playStep(step: number, at: number): void {
    if (!this.audible()) {
      // Muted: keep time, but build no audio nodes nobody would hear.
      return;
    }
    for (const note of this.notesByStep[step]) {
      this.play(note, at);
    }
  }

  private play(note: MenuNote, at: number): void {
    switch (note.voice) {
      case 'pad':
        return this.playPad(note, at);
      case 'bass':
        return this.playBass(note, at);
      case 'bell':
        return this.playBell(note, at);
      case 'breath':
        return this.playBreath(note, at);
    }
  }

  /** Two triangles a few cents apart over a sine, swelling in and out. */
  private playPad(note: MenuNote, at: number): void {
    const context = this.context;
    const duration = note.steps * MENU_STEP_SEC;
    const peak = VOLUME.pad * note.velocity;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 1.8);
    gain.gain.setValueAtTime(peak, at + duration - 1.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration + 1.6);
    gain.connect(this.padFilter);
    const hz = midiToHz(note.midi);
    const voices = [
      { type: 'triangle' as const, hz, detune: -7, level: 1 },
      { type: 'triangle' as const, hz, detune: 7, level: 1 },
      { type: 'sine' as const, hz: hz / 2, detune: 0, level: 0.5 },
    ];
    for (const voice of voices) {
      const oscillator = context.createOscillator();
      oscillator.type = voice.type;
      oscillator.frequency.value = voice.hz;
      oscillator.detune.value = voice.detune;
      const level = context.createGain();
      level.gain.value = voice.level;
      oscillator.connect(level);
      level.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + duration + 1.8);
    }
  }

  /** A sine an octave under the pad, rising slowly. */
  private playBass(note: MenuNote, at: number): void {
    const context = this.context;
    const duration = note.steps * MENU_STEP_SEC;
    const peak = VOLUME.bass * note.velocity;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.7);
    gain.gain.setValueAtTime(peak, at + duration - 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration + 0.6);
    gain.connect(this.bus);
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = midiToHz(note.midi);
    oscillator.connect(gain);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.8);
  }

  /** A sine with two overtones, struck and left to ring. */
  private playBell(note: MenuNote, at: number): void {
    const context = this.context;
    const ring = note.steps * MENU_STEP_SEC;
    const peak = VOLUME.bell * note.velocity;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    gain.gain.setTargetAtTime(0.0001, at + 0.02, ring / 4);
    gain.connect(this.pan(note.pan));
    const hz = midiToHz(note.midi);
    const partials = [
      { ratio: 1, level: 1 },
      { ratio: 2, level: 0.3 },
      { ratio: 3, level: 0.08 },
    ];
    for (const partial of partials) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = hz * partial.ratio;
      const level = context.createGain();
      level.gain.value = partial.level;
      oscillator.connect(level);
      level.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + ring + 0.5);
    }
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
