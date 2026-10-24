import {
  fadeIn,
  fadeOutAndRelease,
  feedbackEcho,
  SoundtrackPlayer,
} from './audio-nodes';
import {
  composeLoop,
  Drum,
  DrumHit,
  DRUM_LEVEL,
  LevelMusic,
  midiToHz,
  MusicLoop,
  MusicNote,
  stepSeconds,
} from './level-music';
import { byStep, StepScheduler } from './step-scheduler';

/** Seconds for the fighting to cool the music back down by two thirds. */
const COOL_DOWN_SEC = 4;

/** Loudness of each voice at full velocity. */
const VOLUME = { lead: 0.045, pad: 0.012, bass: 0.07 } as const;

/**
 * Plays a level's music on a Web Audio context: composes the loop once and
 * hands its notes to a {@link StepScheduler}, which plays them a little
 * ahead of the audio clock.
 *
 * The music answers the match: {@link excite} pushes it towards full
 * intensity - louder drums, a brighter melody - and it cools down again on
 * its own once the fighting stops.
 */
export class MusicPlayer implements SoundtrackPlayer {
  private readonly loop: MusicLoop;
  /** The loop's notes and drum hits, sorted by the sixteenth they fall on. */
  private readonly notesByStep: MusicNote[][];
  private readonly drumsByStep: DrumHit[][];
  private readonly stepSec: number;
  private readonly bus: GainNode;
  private readonly leadFilter: BiquadFilterNode;
  private readonly drumBus: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly scheduler: StepScheduler;
  private intensity = 0;
  /** The intensity the audio params were last steered to. */
  private appliedIntensity = -1;
  private lastTickAt = 0;

  public constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly music: LevelMusic,
    private readonly noise: () => AudioBuffer,
    /** False while nobody would hear it - the notes are then skipped. */
    private readonly audible: () => boolean
  ) {
    this.loop = composeLoop(music);
    this.notesByStep = byStep(this.loop.steps, this.loop.notes);
    this.drumsByStep = byStep(this.loop.steps, this.loop.drums);
    this.stepSec = stepSeconds(music.bpm);
    this.scheduler = new StepScheduler(context, {
      steps: this.loop.steps,
      stepSec: this.stepSec,
      play: (step, at) => this.playStep(step, at),
      tick: (now) => this.coolDown(now),
    });

    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(destination);

    // An echo of a dotted eighth, fed back into itself.
    if (music.echo > 0) {
      this.nodes.push(
        ...feedbackEcho(context, this.bus, destination, {
          delaySec: this.stepSec * 3,
          feedback: music.echo,
          wet: 0.5,
        })
      );
    }

    this.leadFilter = context.createBiquadFilter();
    this.leadFilter.type = 'lowpass';
    this.leadFilter.connect(this.bus);
    this.drumBus = context.createGain();
    this.drumBus.connect(this.bus);
    this.nodes.push(this.leadFilter, this.drumBus);
    this.applyIntensity();
  }

  /**
   * Fades the music in, starting `atSec` seconds into it - a resumed match
   * picks up where its music would be, in step with a map that moves to it.
   */
  public start(atSec = 0): void {
    this.lastTickAt = this.context.currentTime;
    fadeIn(this.context, this.bus, 0.4);
    this.scheduler.start(atSec);
  }

  public stop(): void {
    this.scheduler.stop();
    fadeOutAndRelease(this.context, this.bus, this.nodes, 0.25, 2500);
  }

  /** Heats the music up - by a little for every bacterium that changed sides. */
  public excite(amount: number): void {
    this.intensity = Math.min(1, this.intensity + amount);
  }

  /** Lets the heat of the fighting fade with time. */
  private coolDown(now: number): void {
    this.intensity *= Math.exp(-(now - this.lastTickAt) / COOL_DOWN_SEC);
    this.lastTickAt = now;
    this.applyIntensity();
  }

  private applyIntensity(): void {
    // Only steer the params when the music has audibly changed - every tick
    // would pile up automation events for nothing.
    if (Math.abs(this.intensity - this.appliedIntensity) < 0.01) {
      return;
    }
    this.appliedIntensity = this.intensity;
    const now = this.context.currentTime;
    const level = Math.min(
      1,
      DRUM_LEVEL[this.music.drums] + 0.6 * this.intensity
    );
    this.drumBus.gain.setTargetAtTime(level, now, 0.3);
    this.leadFilter.frequency.setTargetAtTime(
      1800 + 3200 * this.intensity,
      now,
      0.3
    );
  }

  private playStep(step: number, at: number): void {
    if (!this.audible()) {
      // Muted: keep time, but build no audio nodes nobody would hear.
      return;
    }
    for (const note of this.notesByStep[step]) {
      this.playNote(note, at);
    }
    for (const hit of this.drumsByStep[step]) {
      this.playDrum(hit.drum, hit.velocity, at);
    }
  }

  private playNote(note: MusicNote, at: number): void {
    const context = this.context;
    const duration = note.steps * this.stepSec;
    const hz = midiToHz(note.midi);
    const gain = context.createGain();
    const peak = VOLUME[note.voice] * note.velocity;
    // Pads swell in and out, the rest plucks.
    const attack = note.voice === 'pad' ? duration * 0.3 : 0.01;
    const release = note.voice === 'pad' ? duration * 0.4 : 0.08;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setTargetAtTime(peak * 0.6, at + attack, duration * 0.3);
    gain.gain.setTargetAtTime(0.0001, at + duration, release / 3);
    gain.connect(note.voice === 'lead' ? this.leadFilter : this.bus);

    const voices =
      note.voice === 'pad'
        ? // Two voices a few cents apart make the pad shimmer.
          [
            { type: 'triangle' as const, detune: -6 },
            { type: 'triangle' as const, detune: 6 },
          ]
        : [
            {
              type: note.voice === 'lead' ? this.music.lead : 'triangle',
              detune: 0,
            },
          ];
    for (const { type, detune } of voices) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = hz;
      oscillator.detune.value = detune;
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + duration + release + 0.1);
    }
  }

  private playDrum(drum: Drum, velocity: number, at: number): void {
    const context = this.context;
    const gain = context.createGain();
    gain.connect(this.drumBus);
    if (drum === 'kick') {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(120, at);
      oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.14);
      gain.gain.setValueAtTime(0.16 * velocity, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      oscillator.connect(gain);
      oscillator.start(at);
      oscillator.stop(at + 0.25);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = this.noise();
    const filter = context.createBiquadFilter();
    const hat = drum === 'hat';
    filter.type = hat ? 'highpass' : 'bandpass';
    filter.frequency.value = hat ? 7000 : 1800;
    const length = hat ? 0.04 : 0.12;
    gain.gain.setValueAtTime((hat ? 0.025 : 0.05) * velocity, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter);
    filter.connect(gain);
    source.start(at);
    source.stop(at + length + 0.02);
  }
}
