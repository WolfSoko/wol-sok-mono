import { Component, QueryList, ViewChildren } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import image from '../assets/how-to-be-funny.png';
import { provideWsThanosOptions } from './ws-thanos-options.token';
import { WsThanosDirective } from './ws-thanos.directive';
import { WsThanosService } from './ws-thanos.service';

describe('WsThanosDirective', () => {
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
  })
  class HostComponent {
    showComplete = false;
    private wsThanosDirective!: WsThanosDirective;

    @ViewChildren(WsThanosDirective)
    set thanos(thanos: QueryList<WsThanosDirective>) {
      this.wsThanosDirective = thanos.first;
    }

    startThanos() {
      this.showComplete = false;
      return this.wsThanosDirective.vaporize();
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
      imports: [WsThanosDirective],
      providers: [
        provideWsThanosOptions({
          maxParticleCount: 5000,
          animationLength: 2000,
        }),
      ],
      declarations: [HostComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    hostFixture = TestBed.createComponent(HostComponent);
    hostComp = hostFixture.componentInstance;
    hostFixture.detectChanges();
    directive = hostFixture.debugElement.query(
      By.directive(WsThanosDirective)
    ).componentInstance;
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('vaporize()', () => {
    let thanosService: WsThanosService;

    beforeEach(() => {
      thanosService = TestBed.inject(WsThanosService);
      spyOn(thanosService, 'vaporize').and.callThrough();
    });

    it('should call thanosService.vaporize', () => {
      whenVaporizeIsCalled();
      thenThanosServiceVaporizeWasCalled();
    });

    it('should emit when vaporize is complete', (done) => {
      whenVaporizeIsCalled().then(done);
    }, 10000);

    function thenThanosServiceVaporizeWasCalled() {
      expect(thanosService.vaporize).toHaveBeenCalled();
    }

    function whenVaporizeIsCalled(): Promise<void> {
      return firstValueFrom(hostComp.startThanos());
    }
  });
});
