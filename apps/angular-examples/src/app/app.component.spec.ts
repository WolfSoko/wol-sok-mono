import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AuthenticationService } from '@wolsok/feat-api-auth';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { AppComponent } from './app.component';
import { ENV_TOKEN } from './core/env.token';
import { ServiceWorkerLogUpdateService } from './core/service-worker-log-update.service';
import { ServiceWorkerUpdateService } from './core/service-worker-update.service';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';
import { ROUTER_LINKS } from './router-links.token';

describe('AppComponent', () => {
  const createComp = (version: string | null = '1.0.0') => {
    TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
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
        { provide: ENV_TOKEN, useValue: { version } },
      ],
    });
    TestBed.overrideComponent(SideNavComponent, {
      remove: { templateUrl: '' },
      add: { template: '<div>SideNavComp</div>' },
    });
    TestBed.overrideComponent(MainToolbarComponent, {
      set: { template: '<div>ToolbarComp</div>' },
    });
    const fixture: ComponentFixture<AppComponent> =
      TestBed.createComponent(AppComponent);

    const comp: AppComponent = fixture.componentInstance;
    fixture.detectChanges();
    return {
      fixture: fixture,
      component: comp,
    };
  };

  it('should create the app', () => {
    const { component } = createComp();
    expect(component).toBeTruthy();
  });

  it('should inform about the app version', () => {
    const expectedVersion = '1.0.0-test';
    const { fixture } = createComp('1.0.0-test');
    fixture.detectChanges();
    const versionDiv = fixture.debugElement.query(By.css('.app-version'))
      .nativeElement as HTMLDivElement;
    expect(versionDiv.textContent).toEqual(
      'angular-examples@' + expectedVersion
    );
  });

  it('should set app version to next version is not given', () => {
    const { fixture } = createComp(null);
    fixture.detectChanges();
    const versionDiv = fixture.debugElement.query(By.css('.app-version'))
      .nativeElement as HTMLDivElement;
    expect(versionDiv.textContent).toEqual('angular-examples@next');
  });
});
