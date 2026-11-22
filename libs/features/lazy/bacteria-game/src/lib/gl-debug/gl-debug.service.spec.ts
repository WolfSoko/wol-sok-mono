import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { GameSettingsService } from '../settings.service';
import { GameAccount } from '../storage/game-account';
import { GlDebugService } from './gl-debug.service';

describe('GlDebugService', () => {
  let account: FakeGameAccount;

  beforeEach(() => {
    localStorage.clear();
    account = new FakeGameAccount('guest');
    TestBed.configureTestingModule({
      providers: [{ provide: GameAccount, useValue: account }],
    });
  });

  afterEach(() => history.replaceState(null, '', '/'));

  it('is off without ?gldebug', () => {
    history.replaceState(null, '', '/game?level=3');

    const service = TestBed.inject(GlDebugService);

    expect(service.on()).toBe(false);
    expect(location.search).toBe('?level=3');
  });

  it('turns on for the session with ?gldebug and takes it out of the address', () => {
    history.replaceState(null, '', '/game?gldebug&sim=gpu-int#friend=ab');

    const service = TestBed.inject(GlDebugService);

    expect(service.on()).toBe(true);
    expect(location.search).toBe('?sim=gpu-int');
    expect(location.hash).toBe('#friend=ab');
  });

  describe("the owner's switch", () => {
    function switchedOn() {
      account.owner.set(true);
      const service = TestBed.inject(GlDebugService);
      const settings = TestBed.inject(GameSettingsService);
      settings.set('glDebug', true);
      TestBed.tick();
      return { service, settings };
    }

    it('is offered to the owner only', () => {
      const service = TestBed.inject(GlDebugService);

      expect(service.canSwitch()).toBe(false);
      account.owner.set(true);
      expect(service.canSwitch()).toBe(true);
    });

    it('turns the diagnostic on while the owner plays', () => {
      const { service } = switchedOn();

      expect(service.on()).toBe(true);
    });

    it('does nothing for anyone but the owner', () => {
      const service = TestBed.inject(GlDebugService);

      TestBed.inject(GameSettingsService).set('glDebug', true);

      expect(service.on()).toBe(false);
    });

    it('is switched off when the owner signs out, and stays off after the next sign-in', () => {
      const { service, settings } = switchedOn();

      account.owner.set(false);
      TestBed.tick();

      expect(service.on()).toBe(false);
      expect(settings.value('glDebug')).toBe(false);
      account.owner.set(true);
      expect(service.on()).toBe(false);
    });

    it('keeps a stored switch while the owner signs in at the start of a visit', () => {
      const settings = TestBed.inject(GameSettingsService);
      settings.set('glDebug', true);
      const service = TestBed.inject(GlDebugService);
      TestBed.tick();

      account.owner.set(true);
      TestBed.tick();

      expect(service.on()).toBe(true);
      expect(settings.value('glDebug')).toBe(true);
    });

    it('leaves ?gldebug on for anyone, through a sign-out too', () => {
      history.replaceState(null, '', '/?gldebug');
      const { service } = switchedOn();

      account.owner.set(false);
      TestBed.tick();

      expect(service.on()).toBe(true);
    });
  });
});
