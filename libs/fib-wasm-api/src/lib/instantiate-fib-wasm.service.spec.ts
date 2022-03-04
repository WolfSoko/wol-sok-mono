import { TestBed } from '@angular/core/testing';

import { InstantiateFibWasmService } from './instantiate-fib-wasm.service';

describe('InstantiateFibWasmService', () => {
  let service: InstantiateFibWasmService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InstantiateFibWasmService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
