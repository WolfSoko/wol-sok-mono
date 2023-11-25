import { TestBed } from '@angular/core/testing';
import {
  provideWsThanosOptions,
  WS_THANOS_OPTIONS_TOKEN,
} from './ws-thanos-options.token';

describe('WsThanosOptions', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideWsThanosOptions({ maxParticleCount: 12345 })],
    });
  });

  it('should override default options', () => {
    expect(TestBed.inject(WS_THANOS_OPTIONS_TOKEN).maxParticleCount).toEqual(
      12345
    );
  });
});
