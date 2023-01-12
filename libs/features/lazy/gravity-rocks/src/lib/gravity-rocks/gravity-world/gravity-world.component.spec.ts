import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { GravityWorldComponent } from './gravity-world.component';

describe('GravityWorldComponent', () => {
  // TODO: reactivate when error with standalone is fixed: https://github.com/ngneat/spectator/pull/599
  // const createHost = createHostFactory(GravityWorldComponent);

  let component: HostComponent;

  @Component({
    standalone: true,
    imports: [GravityWorldComponent],
    template: ` <feat-lazy-gravity-world></feat-lazy-gravity-world>`,
  })
  class HostComponent {}

  beforeEach(async () => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(HostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });
});
