import { TestBed } from '@angular/core/testing';
import { GlDebugService } from './gl-debug.service';

describe('GlDebugService', () => {
  afterEach(() => history.replaceState(null, '', '/'));

  it('is off without ?gldebug', () => {
    history.replaceState(null, '', '/game?level=3');
    const service = TestBed.inject(GlDebugService);

    service.start();

    expect(service.on()).toBe(false);
    expect(location.search).toBe('?level=3');
  });

  it('turns on for the session with ?gldebug and takes it out of the address', () => {
    history.replaceState(null, '', '/game?gldebug&sim=gpu-int#friend=ab');
    const service = TestBed.inject(GlDebugService);

    service.start();

    expect(service.on()).toBe(true);
    expect(location.search).toBe('?sim=gpu-int');
    expect(location.hash).toBe('#friend=ab');
  });

  it('stays on once started, whatever the address says later', () => {
    history.replaceState(null, '', '/?gldebug=1');
    const service = TestBed.inject(GlDebugService);
    service.start();

    service.start();

    expect(service.on()).toBe(true);
  });
});
