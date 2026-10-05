import { DOCUMENT, inject, Injectable } from '@angular/core';
import type { WsThanosCrumble } from './ws-thanos.options';
import {
  RUMBLE_END,
  rumbleEnvelope,
  sandEnvelope,
  SILENT_AT,
  windEnvelope,
} from './snap-sound-envelopes';

/** a playing snap sound */
export interface SnapSound {
  /** fade out quickly and free the sound */
  stop(): void;
}

const SILENT: SnapSound = { stop: () => undefined };

const NOISE_SEC = 2;
const FADE_OUT_SEC = 0.08;
const PEAK_GRAINS_PER_SEC = 70;
const PEAK_CRACKS_PER_SEC = 160;
/** many small cracks right when the element breaks: they crunch instead of banging like a shot */
const CRUNCH_CRACKS = 32;
const CRUNCH_SEC = 0.4;
/** points of the volume curves */
const CURVE_SAMPLES = 128;

interface UserActivationNavigator {
  userActivation?: { hasBeenActive: boolean };
}

/**
 * Generates the snap sound with Web Audio, no audio files needed:
 * the element breaks with a crunch, a rumble and cracks (dust only crackles thinly),
 * then a gusty wind slowly grows stronger and carries hissing, crackling sand,
 * all fading away in the last third.
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
  public play(
    durationMs: number,
    volume: number,
    crumble: WsThanosCrumble = 'shards'
  ): SnapSound {
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
        voice = this.createVoice(context, durationMs / 1000, crumble);
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

  private createVoice(
    context: AudioContext,
    durationSec: number,
    crumble: WsThanosCrumble
  ): SnapVoice {
    // master and noise are created together with the context
    return new SnapVoice(
      context,
      this.master as GainNode,
      this.noise as AudioBuffer,
      durationSec,
      crumble
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

interface Burst {
  peak: number;
  attack: number;
  decay: number;
  frequency: number;
  q: number;
}

/** the sound layers of one snap: crunch, rumble, cracks, wind, hiss and sand */
class SnapVoice {
  private readonly output: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly start: number;

  public constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
    private readonly noise: AudioBuffer,
    private readonly durationSec: number,
    crumble: WsThanosCrumble
  ) {
    this.start = context.currentTime;
    this.output = context.createGain();
    this.output.gain.setValueAtTime(1, this.start);
    this.output.connect(destination);

    if (crumble === 'dust') {
      // dust trickles away, it only crackles thinly
      this.createCrackles(
        rumbleEnvelope,
        PEAK_CRACKS_PER_SEC / 2,
        [1800, 6000],
        0.25
      );
    } else {
      this.createCrunch();
      this.createRumble();
      this.createCrackles(
        rumbleEnvelope,
        PEAK_CRACKS_PER_SEC,
        [400, 2500],
        0.6
      );
    }
    this.createWind();
    this.createHiss();
    this.createCrackles(sandEnvelope, PEAK_GRAINS_PER_SEC, [2500, 9000], 0.3);
  }

  public stop(): void {
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0, now, FADE_OUT_SEC / 3);
    this.sources.forEach((source) => source.stop(now + FADE_OUT_SEC));
  }

  /** audio context time at the given animation progress */
  private at(progress: number): number {
    return this.start + this.durationSec * progress;
  }

  /** the element breaks: a quick, dense cluster of cracks that gets quieter */
  private createCrunch(): void {
    for (let i = 0; i < CRUNCH_CRACKS; i++) {
      // most cracks right at the start
      const delay = CRUNCH_SEC * Math.pow(Math.random(), 1.6);
      const fading = 1 - delay / (CRUNCH_SEC * 1.25);
      this.createBurst(this.start + delay, {
        peak: 0.75 * fading * random(0.5, 1),
        attack: random(0.004, 0.01),
        decay: random(0.02, 0.07),
        frequency: random(300, 2200),
        q: random(1, 3),
      });
    }
  }

  /** the element breaks: low rumbling noise and a dull thump */
  private createRumble(): void {
    const { context, start } = this;

    const source = this.noiseSource();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(random(140, 200), start);
    filter.Q.setValueAtTime(1.2, start);
    const gain = this.envelopeGain(rumbleEnvelope, 1, RUMBLE_END);
    source.connect(filter).connect(gain).connect(this.output);
    this.startNoise(source, start, this.at(RUMBLE_END));

    const thump = context.createOscillator();
    thump.frequency.setValueAtTime(random(55, 70), start);
    thump.frequency.exponentialRampToValueAtTime(32, start + 0.4);
    const thumpGain = context.createGain();
    // a soft rise makes it a thump, not a bang
    thumpGain.gain.setValueAtTime(0.0001, start);
    thumpGain.gain.linearRampToValueAtTime(0.6, start + 0.03);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    thump.connect(thumpGain).connect(this.output);
    this.startSource(thump, start, start + 0.55);
  }

  /** wind that slowly grows stronger in gusts, it gets brighter the stronger it blows */
  private createWind(): void {
    const { context, start } = this;
    const source = this.noiseSource();
    source.playbackRate.setValueAtTime(random(0.85, 1.15), start);

    const brightness = random(500, 700);
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(0.9, start);
    filter.frequency.setValueCurveAtTime(
      sampleCurve(
        (progress) => 250 + brightness * windEnvelope(progress),
        SILENT_AT
      ),
      start,
      this.durationSec * SILENT_AT
    );

    // gusts: a slow oscillator wobbles the wind volume around 1
    const gusts = context.createGain();
    gusts.gain.setValueAtTime(1, start);
    const gust = context.createOscillator();
    gust.frequency.setValueAtTime(random(0.3, 0.7), start);
    const gustDepth = context.createGain();
    gustDepth.gain.setValueAtTime(0.3, start);
    gust.connect(gustDepth).connect(gusts.gain);

    const gain = this.envelopeGain(windEnvelope, 0.4);
    source.connect(filter).connect(gusts).connect(gain).connect(this.output);
    this.startNoise(source, start, this.at(SILENT_AT));
    this.startSource(gust, start, this.at(SILENT_AT));
  }

  /** bright hiss of the sand blown by the wind */
  private createHiss(): void {
    const { context, start } = this;
    const source = this.noiseSource();
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(random(3500, 4500), start);
    filter.Q.setValueAtTime(0.7, start);
    const gain = this.envelopeGain(sandEnvelope, 0.2);
    source.connect(filter).connect(gain).connect(this.output);
    this.startNoise(source, start, this.at(SILENT_AT));
  }

  /**
   * Short noise bursts: cracks while the element breaks, sand grains in the wind.
   * The envelope sets how dense and loud they are.
   */
  private createCrackles(
    envelope: (progress: number) => number,
    peakPerSec: number,
    [minFrequency, maxFrequency]: [number, number],
    loudness: number
  ): void {
    const { durationSec } = this;
    const end = durationSec * SILENT_AT;
    let t = 0;
    for (;;) {
      t += -Math.log(1 - Math.random()) / peakPerSec;
      const attack = random(0.002, 0.006);
      const decay = random(0.004, 0.025);
      if (t + attack + decay > end) {
        break;
      }
      const density = envelope(t / durationSec);
      if (Math.random() > density) {
        continue;
      }
      this.createBurst(this.start + t, {
        peak: loudness * random(0.3, 1) * density,
        attack,
        decay,
        frequency: random(minFrequency, maxFrequency),
        q: random(2, 6),
      });
    }
  }

  /** one short noise burst, the soft attack keeps it from sounding like a shot */
  private createBurst(
    when: number,
    { peak, attack, decay, frequency, q }: Burst
  ): void {
    const { context } = this;
    const source = context.createBufferSource();
    source.buffer = this.noise;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, when);
    filter.Q.setValueAtTime(q, when);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);

    source.connect(filter).connect(gain).connect(this.output);
    this.startNoise(source, when, when + attack + decay);
  }

  /** a gain that follows the envelope from the start until the given animation progress */
  private envelopeGain(
    envelope: (progress: number) => number,
    loudness: number,
    until = SILENT_AT
  ): GainNode {
    const gain = this.context.createGain();
    gain.gain.setValueCurveAtTime(
      sampleCurve((progress) => loudness * envelope(progress), until),
      this.start,
      this.durationSec * until
    );
    return gain;
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
}

/** sample an envelope from the start of the animation until the given progress */
function sampleCurve(
  envelope: (progress: number) => number,
  until: number
): Float32Array {
  const curve = new Float32Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    curve[i] = envelope((i / (CURVE_SAMPLES - 1)) * until);
  }
  return curve;
}
