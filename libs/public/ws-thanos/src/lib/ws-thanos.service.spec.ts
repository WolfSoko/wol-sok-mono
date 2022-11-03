import { TestBed } from '@angular/core/testing';
import { WsThanosService } from './ws-thanos.service';

describe('WsThanosService', () => {
  it('should be created', () => {
    const service: WsThanosService = TestBed.inject(WsThanosService);
    expect(service).toBeTruthy();
  });
});
