import { TestBed } from '@angular/core/testing';

import { FibonacciJsCalcService } from './fibonacci-js-calc.service';

describe('FibonacciJsCalcService', () => {
  let service: FibonacciJsCalcService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FibonacciJsCalcService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  describe('recursive naive', () => {
    it('should calc the 1st fibonacci number', () => {
      expect(service.calcFibonacciRecursiveNaive(1)).toEqual(1);
    });

    it('should calc the 2nd fibonacci number', () => {
      expect(service.calcFibonacciRecursiveNaive(2)).toEqual(1);
    });

    it('should calc the 5th fibonacci number', () => {
      expect(service.calcFibonacciRecursiveNaive(5)).toEqual(5);
    });

    it('should calc the 20th fibonacci number', () => {
      expect(service.calcFibonacciRecursiveNaive(20)).toEqual(6_765);
    });
  });
  describe('memorize', () => {
    it('should calc the 1st fibonacci number', () => {
      expect(service.calcFibonacciMemoize(1)).toEqual(1);
    });

    it('should calc the 2nd fibonacci number', () => {
      expect(service.calcFibonacciMemoize(2)).toEqual(1);
    });

    it('should calc the 5th fibonacci number', () => {
      expect(service.calcFibonacciMemoize(5)).toEqual(5);
    });

    it('should calc the 20th fibonacci number', () => {
      expect(service.calcFibonacciMemoize(40)).toEqual(102334155);
    });
  });
});
