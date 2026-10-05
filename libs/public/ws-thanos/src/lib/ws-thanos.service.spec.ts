import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';
import { SnapSoundService } from './snap-sound.service';
import { provideWsThanosOptions } from './ws-thanos-options.token';
import { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

jest.mock('html2canvas', () => ({
  __esModule: true,
  default: jest.fn(async () => {
    const data = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    return {
      width: 4,
      height: 4,
      getContext: () => ({
        getImageData: () => ({ width: 4, height: 4, data }),
      }),
    };
  }),
}));

describe('WsThanosService', () => {
  const stopSound = jest.fn();
  const playSound = jest.fn(() => ({ stop: stopSound }));
  let subscription: Subscription | undefined;

  function givenService(
    options: Partial<WsThanosOptions> = {}
  ): WsThanosService {
    TestBed.configureTestingModule({
      providers: [
        provideWsThanosOptions({ animationLength: 300, ...options }),
        { provide: SnapSoundService, useValue: { play: playSound } },
      ],
    });
    return TestBed.inject(WsThanosService);
  }

  function givenElement(): HTMLElement {
    const parent = document.createElement('div');
    const elem = document.createElement('div');
    parent.appendChild(elem);
    document.body.appendChild(parent);
    return elem;
  }

  function vaporize(
    service: WsThanosService,
    elem: HTMLElement,
    options?: Partial<WsThanosOptions>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      subscription = service.vaporize(elem, options).subscribe({
        complete: () => resolve(),
        error: reject,
      });
    });
  }

  function untilEffectStarted(elem: HTMLElement): Promise<HTMLCanvasElement> {
    return new Promise((resolve) => {
      const check = () => {
        const canvas = elem.parentElement?.querySelector('canvas');
        return canvas ? resolve(canvas) : setTimeout(check, 5);
      };
      check();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    // jsdom has neither WebGL nor a 2d context: no WebGL2, a fake 2d context
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement, type: string) {
        if (type !== '2d') {
          return null;
        }
        const { width, height } = this;
        return {
          canvas: this,
          clearRect: () => undefined,
          getImageData: () => ({
            data: new Uint8ClampedArray(width * height * 4),
          }),
          putImageData: () => undefined,
        } as unknown as CanvasRenderingContext2D;
      } as HTMLCanvasElement['getContext']);
  });

  afterEach(() => subscription?.unsubscribe());

  it('should play the snap sound when the effect starts', async () => {
    const service = givenService({ soundVolume: 0.7 });

    await vaporize(service, givenElement());

    expect(playSound).toHaveBeenCalledWith(300, 0.7, 'dust');
  });

  it('should stay silent when the sound is disabled', async () => {
    const service = givenService({ sound: false });

    await vaporize(service, givenElement());

    expect(playSound).not.toHaveBeenCalled();
  });

  it('should let the sound blow away after the effect completed', async () => {
    const service = givenService();

    await vaporize(service, givenElement());

    expect(stopSound).not.toHaveBeenCalled();
  });

  it('should stop the sound when the effect is cancelled', async () => {
    const service = givenService({ animationLength: 10_000 });
    const elem = givenElement();

    void vaporize(service, elem);
    await untilEffectStarted(elem);
    subscription?.unsubscribe();

    expect(stopSound).toHaveBeenCalled();
  });

  it('should mark the effect canvas with the renderer in use', async () => {
    const service = givenService({ animationLength: 10_000 });
    const elem = givenElement();

    void vaporize(service, elem);
    const canvas = await untilEffectStarted(elem);

    expect(canvas.dataset['wsThanosRenderer']).toBe('canvas');
  });

  it('should hide the element quickly when every pixel became a particle', async () => {
    const service = givenService({ animationLength: 10_000 });
    const elem = givenElement();

    void vaporize(service, elem);
    await untilEffectStarted(elem);

    expect(elem.style.transition).toBe('opacity 200ms ease-out');
    expect(elem.style.opacity).toBe('0');
  });

  it('should fade the element slowly when only some pixels became particles', async () => {
    const service = givenService({
      animationLength: 10_000,
      maxParticleCount: 5,
    });
    const elem = givenElement();

    void vaporize(service, elem);
    await untilEffectStarted(elem);

    expect(elem.style.transition).toBe('opacity 8000ms ease-out');
  });

  it('should let a single vaporize override the options', async () => {
    const service = givenService({ soundVolume: 0.7 });

    await vaporize(service, givenElement(), {
      animationLength: 100,
      soundVolume: 0.2,
    });

    expect(playSound).toHaveBeenCalledWith(100, 0.2, 'dust');
  });

  it('should only turn into dust without the GPU', async () => {
    const service = givenService({ animationLength: 10_000 });
    const elem = givenElement();

    void vaporize(service, elem, { crumble: 'chunks' });
    const canvas = await untilEffectStarted(elem);

    expect(canvas.dataset['wsThanosCrumble']).toBe('dust');
  });

  it('should remove the effect canvas when done', async () => {
    const service = givenService();
    const elem = givenElement();

    await vaporize(service, elem);

    expect(elem.parentElement?.querySelector('canvas')).toBeNull();
  });
});
