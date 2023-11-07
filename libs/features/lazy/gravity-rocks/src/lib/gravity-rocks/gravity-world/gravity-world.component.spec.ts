import { createHostFactory, SpectatorHost } from '@ngneat/spectator/jest';
import { qaSelector } from '@wolsok/test-helper';
import { ResizedEvent } from '@wolsok/ui-kit';
import { GravityWorldComponent } from './gravity-world.component';

describe('GravityWorldComponent', () => {
  const createHost = createHostFactory(GravityWorldComponent);
  let spectator: SpectatorHost<GravityWorldComponent>;
  let component: GravityWorldComponent;

  beforeEach(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    spectator = createHost(`<feat-lazy-gravity-world></feat-lazy-gravity-world>`);
    spectator.detectChanges();
    component = spectator.component;
  });

  it('should create the component', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should have a start button', () => {
    expect(spectator.query(qaSelector('cta-start'))).toHaveText('Start');
  });

  it('should start the simulation', () => {
    spectator.click(qaSelector('cta-start'));
    expect(spectator.query(qaSelector('cta-start'))).toHaveText('Pause');
  });

  it('should start again after pause', () => {
    spectator.click(qaSelector('cta-start'));
    spectator.click(qaSelector('cta-start'));
    expect(spectator.query(qaSelector('cta-start'))).toHaveText('Start');
  });

  it('should have a reset button', () => {
    expect(spectator.query(qaSelector('cta-reset'))).toHaveText('Reset');
  });

  it('should stop simulation on reset', () => {
    spectator.click(qaSelector('cta-start'));
    spectator.click(qaSelector('cta-reset'));
    expect(spectator.query(qaSelector('cta-start'))).toHaveText('Start');
  });
});
