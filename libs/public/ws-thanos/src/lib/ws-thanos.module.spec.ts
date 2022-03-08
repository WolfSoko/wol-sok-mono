import { TestBed } from '@angular/core/testing';
import { WsThanosModule } from './ws-thanos.module';

describe('WsThanosModule', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WsThanosModule],
    }).compileComponents();
  });

  // NB: This particular test does not do anything useful.
  //     It does NOT check for correct instantiation of the module.
  it('should have a module definition', () => {
    expect(WsThanosModule).toBeDefined();
  });
});
