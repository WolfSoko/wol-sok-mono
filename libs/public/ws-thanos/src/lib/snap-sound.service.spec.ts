import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SnapSoundService } from './snap-sound.service';

class FakeAudioParam {
  public value = 0;
  public setValueAtTime = jest.fn((value: number) => {
    this.value = value;
    return this;
  });
  public linearRampToValueAtTime = jest.fn(() => this);
  public exponentialRampToValueAtTime = jest.fn(() => this);
  public setTargetAtTime = jest.fn(() => this);
  public cancelScheduledValues = jest.fn(() => this);
  public setValueCurveAtTime = jest.fn(
    (values: Float32Array, startTime: number, duration: number) => {
      this.curves.push({ values, startTime, duration });
      return this;
    }
  );
  public readonly curves: {
    values: Float32Array;
    startTime: number;
    duration: number;
  }[] = [];
}

class FakeAudioNode {
  public readonly connections: unknown[] = [];
  public connect = jest.fn((target: unknown) => {
    this.connections.push(target);
    return target;
  });
  public disconnect = jest.fn();
}

class FakeSourceNode extends FakeAudioNode {
  public buffer: unknown = null;
  public loop = false;
  public readonly frequency = new FakeAudioParam();
  public readonly playbackRate = new FakeAudioParam();
  public start = jest.fn();
  public stop = jest.fn();
}

class FakeAudioContext {
  public static instances: FakeAudioContext[] = [];
  public static initialState: AudioContextState = 'running';
  public static resumeTo: AudioContextState = 'running';

  public state: AudioContextState = FakeAudioContext.initialState;
  public readonly currentTime = 0;
  public readonly sampleRate = 8000;
  public readonly destination = new FakeAudioNode();
  public readonly sources: FakeSourceNode[] = [];
  public readonly gains: (FakeAudioNode & { gain: FakeAudioParam })[] = [];

  public constructor() {
    FakeAudioContext.instances.push(this);
  }

  public resume = jest.fn(async () => {
    this.state = FakeAudioContext.resumeTo;
  });

  public createGain() {
    const gain = Object.assign(new FakeAudioNode(), {
      gain: new FakeAudioParam(),
    });
    this.gains.push(gain);
    return gain;
  }

  public readonly filters: {
    type: string;
    frequency: FakeAudioParam;
  }[] = [];

  public createBiquadFilter() {
    const filter = Object.assign(new FakeAudioNode(), {
      type: 'lowpass',
      frequency: new FakeAudioParam(),
      Q: new FakeAudioParam(),
    });
    this.filters.push(filter);
    return filter;
  }

  public createDynamicsCompressor() {
    return Object.assign(new FakeAudioNode(), {
      threshold: new FakeAudioParam(),
      knee: new FakeAudioParam(),
      ratio: new FakeAudioParam(),
      attack: new FakeAudioParam(),
      release: new FakeAudioParam(),
    });
  }

  public createStereoPanner() {
    return Object.assign(new FakeAudioNode(), { pan: new FakeAudioParam() });
  }

  public createBufferSource() {
    const source = new FakeSourceNode();
    this.sources.push(source);
    return source;
  }

  public createOscillator() {
    const oscillator = new FakeSourceNode();
    this.sources.push(oscillator);
    return oscillator;
  }

  public createBuffer(channels: number, length: number) {
    const data = new Float32Array(length);
    return { length, getChannelData: () => data, numberOfChannels: channels };
  }
}

describe('SnapSoundService', () => {
  let window: {
    AudioContext?: unknown;
    navigator: { userActivation?: unknown };
  };

  function givenWindow(
    userActivation: unknown = { hasBeenActive: true },
    audioContext: unknown = FakeAudioContext
  ): SnapSoundService {
    window = { AudioContext: audioContext, navigator: { userActivation } };
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: window } }],
    });
    return TestBed.inject(SnapSoundService);
  }

  const lastContext = () =>
    FakeAudioContext.instances[FakeAudioContext.instances.length - 1];
  const startedSources = () =>
    lastContext()?.sources.filter(
      (source) => source.start.mock.calls.length > 0
    ) ?? [];
  const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    FakeAudioContext.instances = [];
    FakeAudioContext.initialState = 'running';
    FakeAudioContext.resumeTo = 'running';
  });

  it('should play a sound during the snap', async () => {
    const sound = givenWindow();

    sound.play(2000, 0.5, 'shards');
    await flushPromises();

    expect(startedSources().length).toBeGreaterThan(0);
    const stopTimes = startedSources().map(
      (source) => source.stop.mock.calls[0]?.[0]
    );
    // carries most of the 2 second snap, but is gone before it ends
    expect(Math.max(...stopTimes)).toBeGreaterThanOrEqual(1.6);
    expect(Math.max(...stopTimes)).toBeLessThanOrEqual(2);
  });

  it('should fade out before the animation ends', async () => {
    const sound = givenWindow();

    sound.play(4000, 0.5, 'shards');
    await flushPromises();

    const gains = lastContext().gains.map((gain) => gain.gain);
    const curves = gains.flatMap((gain) => gain.curves);
    expect(curves.length).toBeGreaterThan(2);
    for (const { values, startTime, duration } of curves) {
      expect(startTime + duration).toBeLessThanOrEqual(4 * 0.85);
      expect(values[values.length - 1]).toBe(0);
    }
    const grainsSilencedAt = gains
      .flatMap((gain) => gain.exponentialRampToValueAtTime.mock.calls)
      .map(([, time]) => time as unknown as number);
    expect(Math.max(...grainsSilencedAt)).toBeLessThanOrEqual(4 * 0.85);
  });

  it('should break with a low rumble right at the start', async () => {
    const sound = givenWindow();

    sound.play(6000, 0.5, 'shards');
    await flushPromises();

    const rumbleFilters = lastContext().filters.filter(
      (filter) => filter.type === 'lowpass' && filter.frequency.value <= 250
    );
    expect(rumbleFilters.length).toBeGreaterThan(0);
    // the rumble is over within the first third
    const loopsStopAt = lastContext()
      .sources.filter((source) => source.loop)
      .map((source) => source.stop.mock.calls[0]?.[0] as number);
    expect(Math.min(...loopsStopAt)).toBeLessThanOrEqual(6 * 0.35);
  });

  /** short bursts (cracks, grains) with their start time and loudest value */
  function bursts(): { start: number; peak: number }[] {
    return lastContext()
      .gains.map((gain) => gain.gain)
      .filter((gain) =>
        gain.exponentialRampToValueAtTime.mock.calls.some(
          ([value]) => (value as unknown as number) <= 0.001
        )
      )
      .map((gain) => {
        const values = [
          ...gain.setValueAtTime.mock.calls,
          ...gain.linearRampToValueAtTime.mock.calls,
        ] as unknown as [number, number][];
        return {
          start: Math.min(...values.map(([, time]) => time)),
          peak: Math.max(...values.map(([value]) => value)),
        };
      });
  }

  it('should break with a crunch of many cracks instead of a single bang', async () => {
    const sound = givenWindow();

    sound.play(6000, 0.5, 'shards');
    await flushPromises();

    const crunch = bursts().filter(({ start }) => start < 0.4);
    expect(crunch.length).toBeGreaterThanOrEqual(15);
    expect(Math.max(...crunch.map(({ peak }) => peak))).toBeGreaterThan(0.5);
    // no single burst as loud as a shot
    expect(Math.max(...bursts().map(({ peak }) => peak))).toBeLessThan(0.9);
  });

  it('should rise softly into every crack, a hard edge sounds like a shot', async () => {
    const sound = givenWindow();

    sound.play(6000, 0.5, 'shards');
    await flushPromises();

    const loudBursts = lastContext()
      .gains.map((gain) => gain.gain)
      .filter((gain) =>
        gain.setValueAtTime.mock.calls.some(
          ([value]) => (value as unknown as number) > 0.3
        )
      )
      .filter((gain) =>
        gain.exponentialRampToValueAtTime.mock.calls.some(
          ([value]) => (value as unknown as number) <= 0.001
        )
      );
    expect(loudBursts).toEqual([]);
  });

  it('should only crackle thinly when crumbling to dust', async () => {
    const sound = givenWindow();

    sound.play(6000, 0.5, 'dust');
    await flushPromises();

    const rumbleFilters = lastContext().filters.filter(
      (filter) => filter.type === 'lowpass' && filter.frequency.value <= 250
    );
    expect(rumbleFilters).toEqual([]);
    // no dull thump: an oscillator that drops in pitch
    const thumps = lastContext().sources.filter(
      (source) =>
        source.buffer == null &&
        source.frequency.exponentialRampToValueAtTime.mock.calls.length > 0
    );
    expect(thumps).toEqual([]);
    const crackles = bursts().filter(({ start }) => start < 6 * 0.3);
    expect(crackles.length).toBeGreaterThan(0);
    expect(Math.max(...crackles.map(({ peak }) => peak))).toBeLessThanOrEqual(
      0.3
    );
  });

  it('should crackle with breaking sounds at the start and with sand later', async () => {
    const sound = givenWindow();

    sound.play(6000, 0.5, 'shards');
    await flushPromises();

    const crackles = lastContext().sources.filter(
      (source) => !source.loop && source.buffer != null
    );
    const startTimes = crackles.map(
      (source) => source.start.mock.calls[0]?.[0] as number
    );
    expect(startTimes.some((time) => time < 6 * 0.15)).toBe(true);
    expect(startTimes.some((time) => time > 6 * 0.4)).toBe(true);
  });

  it('should set the master volume', async () => {
    const sound = givenWindow();

    sound.play(1000, 0.3, 'shards');
    await flushPromises();

    const masterGain = lastContext().gains[0];
    expect(masterGain.gain.value).toBe(0.3);
  });

  it('should limit the master output so overlapping snaps stay pleasant', async () => {
    const sound = givenWindow();

    sound.play(1000, 0.5, 'shards');
    await flushPromises();

    const masterGain = lastContext().gains[0];
    const limiter = masterGain.connections[0] as { ratio: FakeAudioParam };
    expect(limiter.ratio).toBeDefined();
    expect((limiter as unknown as FakeAudioNode).connections).toContain(
      lastContext().destination
    );
  });

  it('should share one audio context between snaps', async () => {
    const sound = givenWindow();

    sound.play(1000, 0.5, 'shards');
    sound.play(1000, 0.5, 'shards');
    await flushPromises();

    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('should stay silent before the user interacted with the page', async () => {
    const sound = givenWindow({ hasBeenActive: false });

    sound.play(1000, 0.5, 'shards');
    await flushPromises();

    expect(FakeAudioContext.instances.length).toBe(0);
  });

  it('should not queue the sound when the browser keeps audio blocked', async () => {
    FakeAudioContext.initialState = 'suspended';
    FakeAudioContext.resumeTo = 'suspended';
    const sound = givenWindow(undefined);

    sound.play(1000, 0.5, 'shards');
    await flushPromises();

    expect(lastContext().resume).toHaveBeenCalled();
    expect(startedSources().length).toBe(0);
  });

  it('should play once a suspended context resumes', async () => {
    FakeAudioContext.initialState = 'suspended';
    const sound = givenWindow();

    sound.play(1000, 0.5, 'shards');
    await flushPromises();

    expect(startedSources().length).toBeGreaterThan(0);
  });

  it('should do nothing without Web Audio support', () => {
    const sound = givenWindow({ hasBeenActive: true }, undefined);
    expect(() => sound.play(1000, 0.5, 'shards').stop()).not.toThrow();
  });

  it('should fade out and stop all sources when stopped early', async () => {
    const sound = givenWindow();

    const playing = sound.play(5000, 0.5, 'shards');
    await flushPromises();
    const stopCallsBefore = startedSources().map(
      (s) => s.stop.mock.calls.length
    );
    playing.stop();

    startedSources().forEach((source, i) =>
      expect(source.stop.mock.calls.length).toBe(stopCallsBefore[i] + 1)
    );
  });

  it('should not start a sound that was stopped while the context resumed', async () => {
    FakeAudioContext.initialState = 'suspended';
    const sound = givenWindow();

    sound.play(1000, 0.5, 'shards').stop();
    await flushPromises();

    expect(startedSources().length).toBe(0);
  });
});
