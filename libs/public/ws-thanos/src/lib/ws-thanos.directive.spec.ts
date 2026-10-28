import {
  ChangeDetectionStrategy,
  Component,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { combineLatest, firstValueFrom, of, throwError } from 'rxjs';
import image from '../assets/how-to-be-funny.png';
import { AnimationState } from './animation.state';
import { provideWsThanosOptions } from './ws-thanos-options.token';
import { WsThanosDirective } from './ws-thanos.directive';
import { WsThanosService } from './ws-thanos.service';
import type { WsThanosOptions } from './ws-thanos.options';

describe('Integration Test: WsThanosDirective', () => {
  @Component({
    template: `
      <div
        class="thanos-test-container"
        wsThanos
        (wsThanosComplete)="completed()"
      >
        <h1>My content for the div</h1>
        <img alt="funny-face" style="height: 400px" src="${image}" />
      </div>
      <div class="grid-test">
        <ws-thanos class="div-without-remove" #myThanos="thanos">
          This div should be vaporized when clicked on button and then become
          visible again!
          <div class="inner">Inner container</div>
        </ws-thanos>
        <button (click)="myThanos.vaporize(false)">Vaporize div above</button>
      </div>
    `,
    styles: [
      `
        * {
          box-sizing: border-box;
        }

        .div-without-remove {
          display: grid;
          grid-template-rows: 1fr 1fr 1fr;
          grid-template-columns: 1fr 1fr 1fr;
          place-content: center;
          padding: 50px;
          border: 10px solid darkorange;
          border-radius: 30px;
          height: 300px;
          background-image: linear-gradient(to right, #cbe7e1, #00ae85);
        }

        .inner {
          border-radius: 50%;
          grid-column: 2;
          grid-row: 1;
          background-image: linear-gradient(to right, azure, darkorchid);
          text-align: center;
          padding-top: 1rem;
        }

        .grid-test {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-rows: 1fr auto;
        }

        .thanos-test-container {
          padding: 14px;
        }
      `,
    ],
    imports: [WsThanosDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class HostComponent {
    wsThanosDirective!: WsThanosDirective;

    @ViewChildren(WsThanosDirective)
    set thanos(thanos: QueryList<WsThanosDirective>) {
      this.wsThanosDirective = thanos.first;
    }

    startThanos() {
      return this.wsThanosDirective.vaporize().subscribe();
    }

    completed() {
      console.log('Completed');
    }
  }

  let directive: WsThanosDirective;
  let hostFixture: ComponentFixture<HostComponent>;
  let hostComp: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WsThanosDirective, HostComponent],
      providers: [
        provideWsThanosOptions({
          maxParticleCount: 500,
          animationLength: 1000,
        }),
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    hostFixture = TestBed.createComponent(HostComponent);
    hostComp = hostFixture.componentInstance;
    hostFixture.detectChanges();
    directive = hostComp.wsThanosDirective;
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('vaporize()', () => {
    it('should call thanosService.vaporize', () => {
      givenStubbedThanosService_VaporizeReturns();
      whenVaporizeIsCalled();
      thenThanosServiceVaporizeWasCalled();
    });

    it('should emit animationState', (done) => {
      const animationState: AnimationState = {
        animationT: 0,
        deltaTSec: 0,
        maxHeight: 0,
        maxWidth: 0,
      };
      givenStubbedThanosService_VaporizeReturns(of(animationState));
      directive.vaporize$(false).subscribe({
        next: (result) => {
          expect(result).toEqual(animationState);
          done();
        },
      });
    });

    it('should complete and fade the element back in after a normal effect', async () => {
      const animationState: AnimationState = {
        animationT: 1,
        deltaTSec: 0,
        maxHeight: 0,
        maxWidth: 0,
      };
      givenStubbedThanosService_VaporizeReturns(of(animationState));
      const elem = getDirectiveElement();
      elem.style.opacity = '0';

      await expect(
        firstValueFrom(directive.vaporize(false))
      ).resolves.toBeUndefined();

      expect(elem.style.opacity).toBe('1');
      expect(elem.isConnected).toBe(true);
    });

    it('should still complete when the effect fails synchronously', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      // The error stays unhandled on purpose and RxJS rethrows it on a timeout;
      // catch it on the window so jsdom does not fail the test with it.
      const unhandled: unknown[] = [];
      const onError = (event: ErrorEvent) => {
        unhandled.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', onError);
      try {
        givenStubbedThanosService_VaporizeReturns(
          throwError(() => new Error('no context'))
        );

        await expect(
          firstValueFrom(directive.vaporize(false))
        ).resolves.toBeUndefined();

        expect(consoleError).toHaveBeenCalledWith(
          'Error vaporizing',
          expect.any(Error),
          expect.objectContaining({ removeElem: false })
        );
        await new Promise((resolve) => setTimeout(resolve));
        expect(unhandled).toEqual([new Error('no context')]);
      } finally {
        window.removeEventListener('error', onError);
        consoleError.mockRestore();
      }
    });

    // SKIPPED: This test requires real browser features (html2canvas, canvas rendering, getComputedStyle)
    // that are not properly simulated in jsdom. See E2E tests in apps/ws-thanos-test-app instead.
    it.skip('should emit complete when vaporize is complete', (done) => {
      combineLatest([
        firstValueFrom(directive.wsThanosComplete),
        directive.vaporize$(),
      ]).subscribe({
        complete: done,
      });
    }, 10000);
  });

  function givenStubbedThanosService_VaporizeReturns(
    vaporizeReturns: ReturnType<WsThanosService['vaporize']> = of(
      {} as AnimationState
    )
  ): void {
    const thanosService = getWsThanosService();
    jest.spyOn(thanosService, 'vaporize').mockReturnValue(vaporizeReturns);
  }

  function getWsThanosService(): WsThanosService {
    return TestBed.inject(WsThanosService);
  }

  function getDirectiveElement(): HTMLElement {
    return hostFixture.nativeElement.querySelector('.thanos-test-container');
  }

  function thenThanosServiceVaporizeWasCalled() {
    expect(getWsThanosService().vaporize).toHaveBeenCalled();
  }

  function whenVaporizeIsCalled(): void {
    directive.vaporize$(false).subscribe();
  }
});

describe('WsThanosDirective options input', () => {
  @Component({
    template: `<div wsThanos [wsThanosOptions]="options"></div>`,
    imports: [WsThanosDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class OptionsHostComponent {
    public options: Partial<WsThanosOptions> = {
      crumble: 'chunks',
      animationLength: 1234,
    };

    @ViewChildren(WsThanosDirective)
    public thanos!: QueryList<WsThanosDirective>;
  }

  it('should vaporize with the options of the element', () => {
    const fixture = TestBed.createComponent(OptionsHostComponent);
    fixture.detectChanges();
    const service = TestBed.inject(WsThanosService);
    jest.spyOn(service, 'vaporize').mockReturnValue(of({} as AnimationState));

    fixture.componentInstance.thanos.first.vaporize$(false).subscribe();

    expect(service.vaporize).toHaveBeenCalledWith(expect.any(HTMLElement), {
      crumble: 'chunks',
      animationLength: 1234,
    });
  });
});

describe('WsThanosDirective preload', () => {
  @Component({
    template: `<div wsThanos [wsThanosOptions]="elementOptions"></div>`,
    imports: [WsThanosDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class PreloadHostComponent {
    public elementOptions?: Partial<WsThanosOptions>;
  }

  async function renderWith(
    options: Partial<WsThanosOptions>,
    elementOptions?: Partial<WsThanosOptions>
  ): Promise<jest.SpyInstance> {
    TestBed.configureTestingModule({
      providers: [provideWsThanosOptions(options)],
    });
    const preload = jest
      .spyOn(TestBed.inject(WsThanosService), 'preload')
      .mockResolvedValue();
    const fixture = TestBed.createComponent(PreloadHostComponent);
    fixture.componentInstance.elementOptions = elementOptions;
    await fixture.whenStable();
    return preload;
  }

  it('should warm up the effect after the first render', async () => {
    const preload = await renderWith({});

    expect(preload).toHaveBeenCalled();
  });

  it('should not warm up when preload is off', async () => {
    const preload = await renderWith({ preload: false });

    expect(preload).not.toHaveBeenCalled();
  });

  it('should not warm up when the element turns preload off', async () => {
    const preload = await renderWith({}, { preload: false });

    expect(preload).not.toHaveBeenCalled();
  });
});
