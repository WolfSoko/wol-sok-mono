import { Component, QueryList, ViewChildren } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { combineLatest, firstValueFrom, of } from 'rxjs';
import image from '../assets/how-to-be-funny.png';
import { AnimationState } from './animation.state';
import { provideWsThanosOptions } from './ws-thanos-options.token';
import { WsThanosDirective } from './ws-thanos.directive';
import { WsThanosService } from './ws-thanos.service';

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
    standalone: true,
    imports: [WsThanosDirective],
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

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [WsThanosDirective, HostComponent],
      providers: [
        provideWsThanosOptions({
          maxParticleCount: 500,
          animationLength: 1000,
        }),
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    hostFixture = TestBed.createComponent(HostComponent);
    hostComp = hostFixture.componentInstance;
    hostFixture.detectChanges();
    directive = hostComp.wsThanosDirective;
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('vaporizeAndScrollIntoView$()', () => {
    it('should call thanosService.vaporizeAndScrollIntoView', () => {
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

    it('should emit complete when vaporizeAndScrollIntoView is complete', (done) => {
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
    spyOn(thanosService, 'vaporize').and.returnValue(vaporizeReturns);
  }

  function getWsThanosService(): WsThanosService {
    return TestBed.inject(WsThanosService);
  }

  function thenThanosServiceVaporizeWasCalled() {
    expect(getWsThanosService().vaporize).toHaveBeenCalled();
  }

  function whenVaporizeIsCalled(): void {
    directive.vaporize$(false).subscribe();
  }
});
