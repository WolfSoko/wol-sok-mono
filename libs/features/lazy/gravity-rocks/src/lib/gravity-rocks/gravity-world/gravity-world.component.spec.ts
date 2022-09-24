
import { createHostFactory } from "@ngneat/spectator";
import { GravityWorldComponent } from './gravity-world.component';

describe('GravityWorldComponent', () => {

  const createHost = createHostFactory(GravityWorldComponent)

  it('should create the component',  () => {
        expect(createHost(`<feat-lazy-gravity-world></feat-lazy-gravity-world>`).component).toBeTruthy();
  });
});


