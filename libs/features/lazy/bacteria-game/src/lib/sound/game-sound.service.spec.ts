import { TestBed } from '@angular/core/testing';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from './game-sound.service';
import { levelMusic } from './level-music';
import { MusicPlayer } from './music-player';

describe('GameSoundService', () => {
  it('stays silent without the Web Audio API instead of throwing', () => {
    const sound = TestBed.inject(GameSoundService);

    expect(() => {
      sound.matchStart(levelMusic('serpentine'));
      sound.boost(false);
      sound.setMusic('menu');
      sound.setMusic(levelMusic('heartbeat'), 3);
      sound.frame({
        boosts: [true],
        captures: 3,
        pelletsEaten: 1,
        crushed: 2,
        gatesClosed: 1,
        gatesWarned: 1,
      });
      sound.tick();
      sound.pause();
      sound.resume();
      sound.navigate();
      sound.previewEffects();
      sound.matchEnd('win');
      sound.matchEnd('loss');
      sound.matchEnd('draw');
      sound.matchEnd('win', 'gold');
      sound.setMusic(null);
    }).not.toThrow();
  });

  describe('with the Web Audio API', () => {
    let sound: GameSoundService;
    let settings: GameSettingsService;
    let context: FakeAudioContext;

    beforeEach(() => {
      localStorage.clear();
      jest.useFakeTimers();
      context = new FakeAudioContext();
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: jest.fn(() => context),
      });
      TestBed.resetTestingModule();
      sound = TestBed.inject(GameSoundService);
      settings = TestBed.inject(GameSettingsService);
      // The gesture that wakes the audio, without waking the services of
      // the tests before, which still listen to the document.
      (sound as unknown as { unlock(): void }).unlock();
    });

    afterEach(() => {
      sound.setMusic(null);
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: undefined,
      });
    });

    it('wakes up on a gesture and routes music and effects through buses of their own', () => {
      expect(context.resumed).toBe(true);
      // Master, music bus and effects bus.
      expect(context.gains.length).toBe(3);
      expect(context.compressors).toBe(1);
    });

    it('plays the menu music, and stops it for a level', () => {
      sound.setMusic('menu');
      jest.advanceTimersByTime(200);
      const menuNodes = context.started;
      expect(menuNodes).toBeGreaterThan(0);

      sound.setMusic(levelMusic('corridors'));
      jest.advanceTimersByTime(200);
      expect(context.started).toBeGreaterThan(menuNodes);

      // Asking again for what plays changes nothing.
      const before = context.started;
      sound.setMusic(levelMusic('corridors'));
      expect(context.started).toBe(before);
    });

    it('makes no effect nodes while the effects are off', () => {
      settings.setEffects(false);
      sound.boost(false);
      sound.matchEnd('win');
      expect(context.started).toBe(0);

      settings.setEffects(true);
      sound.boost(false);
      expect(context.started).toBeGreaterThan(0);
    });

    it('follows the switches without waiting for an effect to run', () => {
      settings.setSound(false);
      sound.tick();
      expect(context.started).toBe(0);

      settings.setSound(true);
      sound.tick();
      expect(context.started).toBe(1);
      // The master bus was steered up by the tick itself.
      expect(context.gains[0].targets).toEqual([0, 1]);
    });

    it('heats the level music up with the fighting even with the effects off', () => {
      const excite = jest.spyOn(MusicPlayer.prototype, 'excite');
      sound.setMusic(levelMusic('corridors'));
      settings.setEffects(false);

      sound.frame({
        boosts: [],
        captures: 10,
        pelletsEaten: 0,
        crushed: 0,
        gatesClosed: 0,
        gatesWarned: 0,
      });

      expect(excite).toHaveBeenCalledWith(0.04);
    });

    it('makes no effect nodes at volume zero either', () => {
      settings.setEffectsVolume(0);
      sound.pause();
      expect(context.started).toBe(0);
    });

    it('climbs the pellet ladder for pellets eaten in a row', () => {
      const pellet = () =>
        sound.frame({
          boosts: [],
          captures: 0,
          pelletsEaten: 1,
          crushed: 0,
          gatesClosed: 0,
          gatesWarned: 0,
        });
      pellet();
      const first = context.frequencies[0];
      context.time += 0.3;
      pellet();
      const second = context.frequencies[2];
      expect(second).toBeGreaterThan(first);

      // A pause starts the ladder over.
      context.time += 5;
      pellet();
      expect(context.frequencies[4]).toBeCloseTo(first);
    });
  });
});

/** Just enough of an AudioContext to count what the service builds. */
class FakeAudioContext {
  public time = 0;
  public resumed = false;
  public state = 'suspended';
  public gains: FakeGainNode[] = [];
  public compressors = 0;
  /** Sources started, oscillators and buffers alike. */
  public started = 0;
  /** The frequency every oscillator was set to, in the order started. */
  public frequencies: number[] = [];
  public readonly sampleRate = 8000;
  public readonly destination = new FakeNode();

  public get currentTime(): number {
    return this.time;
  }

  public resume(): Promise<void> {
    this.resumed = true;
    this.state = 'running';
    return Promise.resolve();
  }

  public suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  public createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  public createDynamicsCompressor(): FakeParamNode {
    this.compressors++;
    return new FakeParamNode([
      'threshold',
      'knee',
      'ratio',
      'attack',
      'release',
    ]);
  }

  public createBiquadFilter(): FakeParamNode {
    return new FakeParamNode(['frequency', 'Q']);
  }

  public createDelay(): FakeParamNode {
    return new FakeParamNode(['delayTime']);
  }

  public createStereoPanner(): FakeParamNode {
    return new FakeParamNode(['pan']);
  }

  public createPeriodicWave(): object {
    return {};
  }

  public createOscillator(): FakeSource {
    const node = new FakeSource(this, ['frequency', 'detune']);
    const frequency = node.frequency as FakeParam;
    const record = (value: number) => this.frequencies.push(value);
    frequency.setValueAtTime = (value) => {
      record(value);
      return frequency;
    };
    Object.defineProperty(frequency, 'value', {
      set: record,
      get: () => 0,
    });
    return node;
  }

  public createBufferSource(): FakeSource {
    return new FakeSource(this, []);
  }

  public createBuffer(
    _channels: number,
    length: number
  ): { getChannelData(): Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

class FakeNode {
  public connect(): void {}
  public disconnect(): void {}
}

class FakeParam {
  public value = 0;
  public setValueAtTime(): FakeParam {
    return this;
  }
  public exponentialRampToValueAtTime(): FakeParam {
    return this;
  }
  public setTargetAtTime(_value?: number): FakeParam {
    return this;
  }
  public cancelScheduledValues(): FakeParam {
    return this;
  }
}

class FakeParamNode extends FakeNode {
  [param: string]: unknown;

  public constructor(params: string[]) {
    super();
    for (const param of params) {
      this[param] = new FakeParam();
    }
  }
}

/** A gain node that remembers where its gain was steered to. */
class FakeGainNode extends FakeParamNode {
  public readonly targets: number[] = [];

  public constructor() {
    super(['gain']);
    const gain = this.gain as FakeParam;
    gain.setTargetAtTime = (value: number) => {
      this.targets.push(value);
      return gain;
    };
  }
}

class FakeSource extends FakeParamNode {
  public type = 'sine';
  public buffer: unknown = null;
  public loop = false;

  public setPeriodicWave(): void {}

  public constructor(
    private readonly context: FakeAudioContext,
    params: string[]
  ) {
    super(params);
  }

  public start(): void {
    this.context.started++;
  }

  public stop(): void {}
}
