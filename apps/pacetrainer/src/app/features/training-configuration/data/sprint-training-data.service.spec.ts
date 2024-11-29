import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SprintTrainingDataService } from './sprint-training-data.service';
import {
  PLATFORM_ID,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SprintTrainingInputData } from './sprint-training-input.data';

describe('SprintTrainingDataService', () => {
  let service: SprintTrainingDataService;

  function initTest(platformId: 'browser' | 'server' = 'browser'): void {
    vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn() });
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: platformId },
        SprintTrainingDataService,
      ],
    });
    service = TestBed.inject(SprintTrainingDataService);
  }

  describe('browser/general behavior', () => {
    beforeEach(() => {
      initTest('browser');
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should calculate total time correctly', () => {
      service.repetitions.set(4);
      service.sprintTime.set(10);
      service.recoveryTime.set(60);
      expect(service.totalTime()).toEqual(280);
    });

    it('should update state correctly', () => {
      service.updateState({ repetitions: 5, sprintTime: 15, recoveryTime: 30 });
      expect(service.repetitions()).toEqual(5);
      expect(service.sprintTime()).toEqual(15);
      expect(service.recoveryTime()).toEqual(30);
    });

    it('should handle partial updates', () => {
      service.updateState({ sprintTime: 20 });
      expect(service.sprintTime()).toEqual(20);
      expect(service.repetitions()).toEqual(4); // default value
      expect(service.recoveryTime()).toEqual(60); // default value
    });

    it('should save to localStorage when in browser', () => {
      service.updateState({ repetitions: 3 });
      TestBed.flushEffects();
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'sprintTrainingData',
        JSON.stringify({ repetitions: 3, sprintTime: 10, recoveryTime: 60 })
      );
    });

    it('should load from localStorage if data exists', () => {
      const mockData: SprintTrainingInputData = {
        repetitions: 6,
        sprintTime: 12,
        recoveryTime: 45,
      };

      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockData));

      TestBed.runInInjectionContext(() => {
        service = new SprintTrainingDataService();
      });

      expect(service.repetitions()).toEqual(6);
      expect(service.sprintTime()).toEqual(12);
      expect(service.recoveryTime()).toEqual(45);
    });
  });

  describe('server behavior', () => {
    it('should not save to localStorage when not in browser', () => {
      initTest('server');
      service = TestBed.inject(SprintTrainingDataService);
      service.updateState({ repetitions: 3 });
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });
});
