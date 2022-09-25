import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { createHostFactory } from '@ngneat/spectator';
import { Angulartics2Module } from 'angulartics2';
import { AppComponent } from './app.component';
import { ENV_TOKEN } from './core/env.token';
import { ROUTER_LINKS } from './router-links.token';

describe('AppComponent', () => {
  const createComp = createHostFactory({
    component: AppComponent,
    imports: [RouterTestingModule, Angulartics2Module.forRoot()],
    providers: [
      { provide: ENV_TOKEN, useValue: { version: 'v1.2.3' } },
      {
        provide: ROUTER_LINKS,
        useValue: [],
      },
    ],
    schemas: [NO_ERRORS_SCHEMA],
    declarations: [AppComponent],
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();
  });

  it('should create the app', () => {
    const spectator = createComp('<app-root></app-root>');
    const app = spectator.component;
    expect(app).toBeTruthy();
  });

  it('should inform about the app version', () => {
    const spectator = createComp('<app-root></app-root>');
    expect(spectator.debugElement.attributes['app-version']).toEqual(
      'angular-examples@v1.2.3'
    );
  });
});
