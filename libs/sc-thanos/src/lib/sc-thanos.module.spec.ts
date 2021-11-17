import { TestBed } from '@angular/core/testing';
import { ScThanosModule } from './sc-thanos.module';

describe('ScThanosModule', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScThanosModule],
    }).compileComponents();
  });

  // TODO: Add real tests here.
  //
  // NB: This particular test does not do anything useful.
  //     It does NOT check for correct instantiation of the module.
  it('should have a module definition', () => {
    expect(ScThanosModule).toBeDefined();
  });
});
