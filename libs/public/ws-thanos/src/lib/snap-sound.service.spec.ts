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

  public createBiquadFilter() {
    return Object.assign(new FakeAudioNode(), {
      type: 'lowpass',
      frequency: new FakeAudioParam(),
      Q: new FakeAudioParam(),
    });
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

    sound.play(2000, 0.5);
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

    sound.play(4000, 0.5);
    await flushPromises();

    const silencedAt = lastContext()
      .gains.flatMap(
        (gain) => gain.gain.exponentialRampToValueAtTime.mock.calls
      )
      .filter(([value]) => (value as unknown as number) <= 0.001)
      .map(([, time]) => time as unknown as number);
    expect(silencedAt.length).toBeGreaterThan(2);
    expect(Math.max(...silencedAt)).toBeLessThanOrEqual(4 * 0.85);
  });

  it('should set the master volume', async () => {
    const sound = givenWindow();

    sound.play(1000, 0.3);
    await flushPromises();

    const masterGain = lastContext().gains[0];
    expect(masterGain.gain.value).toBe(0.3);
  });

  it('should limit the master output so overlapping snaps stay pleasant', async () => {
    const sound = givenWindow();

    sound.play(1000, 0.5);
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

    sound.play(1000, 0.5);
    sound.play(1000, 0.5);
    await flushPromises();

    expect(FakeAudioContext.instances.length).toBe(1);
  });

  it('should stay silent before the user interacted with the page', async () => {
    const sound = givenWindow({ hasBeenActive: false });

    sound.play(1000, 0.5);
    await flushPromises();

    expect(FakeAudioContext.instances.length).toBe(0);
  });

  it('should not queue the sound when the browser keeps audio blocked', async () => {
    FakeAudioContext.initialState = 'suspended';
    FakeAudioContext.resumeTo = 'suspended';
    const sound = givenWindow(undefined);

    sound.play(1000, 0.5);
    await flushPromises();

    expect(lastContext().resume).toHaveBeenCalled();
    expect(startedSources().length).toBe(0);
  });

  it('should play once a suspended context resumes', async () => {
    FakeAudioContext.initialState = 'suspended';
    const sound = givenWindow();

    sound.play(1000, 0.5);
    await flushPromises();

    expect(startedSources().length).toBeGreaterThan(0);
  });

  it('should do nothing without Web Audio support', () => {
    const sound = givenWindow({ hasBeenActive: true }, undefined);
    expect(() => sound.play(1000, 0.5).stop()).not.toThrow();
  });

  it('should fade out and stop all sources when stopped early', async () => {
    const sound = givenWindow();

    const playing = sound.play(5000, 0.5);
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

    sound.play(1000, 0.5).stop();
    await flushPromises();

    expect(startedSources().length).toBe(0);
  });
});
