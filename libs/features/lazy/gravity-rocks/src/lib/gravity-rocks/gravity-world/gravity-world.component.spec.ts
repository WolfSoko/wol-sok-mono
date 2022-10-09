import { createHostFactory } from '@ngneat/spectator';
import { GravityWorldComponent } from './gravity-world.component';

describe('GravityWorldComponent', () => {
  const createHost = createHostFactory(GravityWorldComponent);

  beforeEach(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  it('should create the component', () => {
    expect(
      createHost(`<feat-lazy-gravity-world></feat-lazy-gravity-world>`)
        .component
    ).toBeTruthy();
  });
});
