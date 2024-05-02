import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AuthenticationService } from '@wolsok/feat-api-auth';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { AppComponent } from './app.component';
import { ServiceWorkerLogUpdateService } from './core/service-worker-log-update.service';
import { ServiceWorkerUpdateService } from './core/service-worker-update.service';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';
import { ROUTER_LINKS } from './router-links.token';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterModule.forRoot([]),
        HttpClientTestingModule,
      ],
      providers: [
        { provide: ROUTER_LINKS, useValue: [] },
        {
          provide: Angulartics2GoogleTagManager,
          useValue: { startTracking: jest.fn() },
        },
        {
          provide: ServiceWorkerLogUpdateService,
          useValue: { startLogging: jest.fn() },
        },
        {
          provide: ServiceWorkerUpdateService,
          useValue: { startLogging: jest.fn() },
        },
        {
          provide: AuthenticationService,
          useValue: { startLogging: jest.fn() },
        },
      ],
    });
  });

  const createComp = () => {
    TestBed.overrideComponent(SideNavComponent, {
      remove: { templateUrl: '' },
      add: { template: '<div>SideNavComp</div>' },
    });
    TestBed.overrideComponent(MainToolbarComponent, {
      set: { template: '<div>ToolbarComp</div>' },
    });
    const fixture: ComponentFixture<AppComponent> =
      TestBed.createComponent(AppComponent);

    const httpTestingController: HttpTestingController = TestBed.inject(
      HttpTestingController
    );
    const comp: AppComponent = fixture.componentInstance;
    fixture.detectChanges();
    return {
      fixture: fixture,
      component: comp,
      httpTestingController,
    };
  };

  it('should create the app', () => {
    const { component } = createComp();
    expect(component).toBeTruthy();
  });

  it('should inform about the app version', () => {
    const { fixture, httpTestingController } = createComp();
    httpTestingController.expectOne('/version.json').flush('1.2.3');
    fixture.detectChanges();
    const versionDiv = fixture.debugElement.query(By.css('.app-version'))
      .nativeElement as HTMLDivElement;
    expect(versionDiv.textContent).toEqual('angular-examples@1.2.3');
  });

  it('should set app version to next of request failed', () => {
    const { fixture, httpTestingController } = createComp();
    httpTestingController
      .expectOne('/version.json')
      .flush(null, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    const versionDiv = fixture.debugElement.query(By.css('.app-version'))
      .nativeElement as HTMLDivElement;
    expect(versionDiv.textContent).toEqual('angular-examples@next');
  });
});
