import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthenticationService } from '@wolsok/feat-api-auth';
import { Angulartics2GoogleTagManager } from 'angulartics2';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { ServiceWorkerLogUpdateService } from './core/service-worker-log-update.service';
import { ServiceWorkerUpdateService } from './core/service-worker-update.service';
import { MainToolbarComponent } from './feature/main-toolbar/main-toolbar.component';
import { SideNavComponent } from './feature/navigation/side-nav/side-nav.component';
import { ROUTER_LINKS } from './router-links.token';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [RouterTestingModule, AppModule],
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
    const fixture: ComponentFixture<AppComponent> = TestBed.createComponent(AppComponent);
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
    const { fixture } = createComp();
    expect(fixture.debugElement.attributes['app-version']).toEqual('angular-examples@v1.2.3');
  });
});
