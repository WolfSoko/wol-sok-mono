import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Angulartics2Module } from 'angulartics2';
import { AppComponent } from './app.component';
import { ROUTER_LINKS } from './router-links.token';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, Angulartics2Module.forRoot()],
      providers: [
        {
          provide: ROUTER_LINKS,
          useValue: [],
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
      declarations: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
