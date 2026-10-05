import { DOCUMENT, inject, Injectable } from '@angular/core';

/** a playing snap sound */
export interface SnapSound {
  /** fade out quickly and free the sound */
  stop(): void;
}

const SILENT: SnapSound = { stop: () => undefined };

/** part of the animation after which the sound has blown away */
const SILENT_AT = 0.85;
const NOISE_SEC = 2;
const FADE_OUT_SEC = 0.08;
const PEAK_GRAINS_PER_SEC = 70;

interface UserActivationNavigator {
  userActivation?: { hasBeenActive: boolean };
}

/**
 * Generates a windy, sandy sound with Web Audio, no audio files needed:
 * a gusty wind, a sand hiss and tiny crackling grains, all timed to the snap.
 * Every snap sounds a bit different.
 */
@Injectable({ providedIn: 'root' })
export class SnapSoundService {
  private readonly window = inject(DOCUMENT).defaultView as
    | (Window & { AudioContext?: typeof AudioContext })
    | null;
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;

  /**
   * Play the snap sound. Stays silent when the browser does not allow audio yet,
   * e.g. before the user interacted with the page.
   */
  public play(durationMs: number, volume: number): SnapSound {
    const context = this.getContext();
    if (context == null || this.master == null) {
      return SILENT;
    }
    this.master.gain.setValueAtTime(
      Math.min(1, Math.max(0, volume)),
      context.currentTime
    );

    let voice: SnapVoice | undefined;
    let stopped = false;
    const start = () => {
      if (!stopped && context.state === 'running') {
        voice = this.createVoice(context, durationMs / 1000);
      }
    };

    if (context.state === 'running') {
      start();
    } else {
      context.resume().then(start, () => undefined);
    }

    return {
      stop: () => {
        stopped = true;
        voice?.stop();
      },
    };
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }
    const AudioContextCtor = this.window?.AudioContext;
    const navigator = this.window?.navigator as UserActivationNavigator;
    // creating a context before any user interaction only produces browser warnings
    if (
      AudioContextCtor == null ||
      navigator?.userActivation?.hasBeenActive === false
    ) {
      return undefined;
    }

    const context = new AudioContextCtor();
    // a limiter keeps many simultaneous snaps from getting too loud
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-12, 0);
    limiter.knee.setValueAtTime(6, 0);
    limiter.ratio.setValueAtTime(12, 0);
    limiter.attack.setValueAtTime(0.005, 0);
    limiter.release.setValueAtTime(0.3, 0);
    limiter.connect(context.destination);

    this.master = context.createGain();
    this.master.connect(limiter);
    this.noise = createNoiseBuffer(context);
    this.context = context;
    return context;
  }

  private createVoice(context: AudioContext, durationSec: number): SnapVoice {
    // master and noise are created together with the context
    return new SnapVoice(
      context,
      this.master as GainNode,
      this.noise as AudioBuffer,
      durationSec
    );
  }
}

/** pinkish noise: white noise with a gentle low pass, sounds softer and more natural */
function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE_SEC);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    data[i] = last * 1.8;
  }
  return buffer;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** the three sound layers of one snap */
class SnapVoice {
  private readonly output: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly silentAt: number;

  public constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly noise: AudioBuffer,
    private readonly durationSec: number
  ) {
    const now = context.currentTime;
    this.silentAt = now + durationSec * SILENT_AT;
    this.output = context.createGain();
    this.output.gain.setValueAtTime(1, now);
    this.output.connect(destination);

    this.createWind(now);
    this.createHiss(now);
    this.createGrains(now);
  }

  public stop(): void {
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0, now, FADE_OUT_SEC / 3);
    this.sources.forEach((source) => source.stop(now + FADE_OUT_SEC));
  }

  private noiseSource(): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    return source;
  }

  /** start a source now or later and stop it at the given time */
  private startSource(
    source: AudioScheduledSourceNode,
    when: number,
    until: number
  ): void {
    source.start(when);
    this.scheduleStop(source, until);
  }

  /** start a noise source at a random position of the noise buffer */
  private startNoise(
    source: AudioBufferSourceNode,
    when: number,
    until: number
  ): void {
    source.start(when, random(0, NOISE_SEC - 0.05));
    this.scheduleStop(source, until);
  }

  private scheduleStop(source: AudioScheduledSourceNode, until: number): void {
    source.stop(until);
    source.onended = () => source.disconnect();
    this.sources.push(source);
  }

  /** low rumbling noise with a moving filter and slow gusts */
  private createWind(now: number): void {
    const { context, durationSec, silentAt } = this;
    const source = this.noiseSource();
    source.playbackRate.setValueAtTime(random(0.85, 1.15), now);

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(0.9, now);
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(
      random(700, 1000),
      now + durationSec * 0.35
    );
    filter.frequency.exponentialRampToValueAtTime(220, silentAt);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.55, now + durationSec * 0.15);
    gain.gain.setValueAtTime(0.55, now + durationSec * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, silentAt);

    // gusts: a slow oscillator wobbles the wind volume
    const gust = context.createOscillator();
    gust.frequency.setValueAtTime(random(0.4, 0.9), now);
    const gustDepth = context.createGain();
    gustDepth.gain.setValueAtTime(0.25, now);
    gust.connect(gustDepth).connect(gain.gain);

    source.connect(filter).connect(gain).connect(this.output);
    this.startNoise(source, now, silentAt);
    this.startSource(gust, now, silentAt);
  }

  /** bright sand hiss, loudest while the vaporizing front sweeps the element */
  private createHiss(now: number): void {
    const { context, durationSec, silentAt } = this;
    const source = this.noiseSource();

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(random(3500, 4500), now);
    filter.Q.setValueAtTime(0.7, now);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + durationSec * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec * 0.75);

    source.connect(filter).connect(gain).connect(this.output);
    this.startNoise(source, now, silentAt);
  }

  /** tiny crackles of sand grains, most dense when the most particles break off */
  private createGrains(now: number): void {
    const { context, durationSec } = this;
    const grainsEnd = durationSec * SILENT_AT;
    // grain density rises and falls with the vaporizing front
    const densityAt = (t: number) => Math.sin((Math.PI * t) / grainsEnd);
    let t = 0;
    for (;;) {
      const rate = Math.max(1, PEAK_GRAINS_PER_SEC * densityAt(t));
      t += -Math.log(1 - Math.random()) / rate;
      const length = random(0.004, 0.02);
      if (t + length > grainsEnd) {
        break;
      }
      const density = densityAt(t);
      if (Math.random() > density) {
        continue;
      }
      const when = now + t;

      const source = context.createBufferSource();
      source.buffer = this.noise;

      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(random(2500, 9000), when);
      filter.Q.setValueAtTime(random(2, 6), when);

      const gain = context.createGain();
      gain.gain.setValueAtTime(random(0.08, 0.3) * density, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + length);

      source.connect(filter).connect(gain).connect(this.output);
      this.startNoise(source, when, when + length);
    }
  }
}
