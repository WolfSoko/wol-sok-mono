import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { seconds, sToMs } from '../../../shared/model/constants/time-utils';
import { provideRepositoryMock } from '../../../shared/repository/provide-repository.mock';
import { RepositoryFactoryMock } from '../../../shared/repository/repository.factory.mock';
import { SprintTrainingDataService } from './sprint-training-data.service';
import { SprintTrainingInputData } from './sprint-training-input.data';

describe('SprintTrainingDataService', () => {
  let service: SprintTrainingDataService;
  let repositoryFactoryMock: RepositoryFactoryMock<SprintTrainingInputData>;

  function initTest(initialData?: SprintTrainingInputData): void {
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        provideRepositoryMock(),
      ],
    });
    repositoryFactoryMock = TestBed.inject(
      RepositoryFactoryMock<SprintTrainingInputData>
    );
    if (initialData) {
      repositoryFactoryMock.initialData = initialData;
    }
    service = TestBed.inject(SprintTrainingDataService);
  }

  describe('fresh initialization', () => {
    beforeEach(() => {
      initTest();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should calculate total time correctly', () => {
      service.repetitions.set(4);
      service.sprintTime.set(sToMs(seconds(10)));
      service.recoveryTime.set(sToMs(seconds(60)));
      expect(service.totalTime()).toEqual(sToMs(seconds(280)));
    });

    it('should update state correctly', () => {
      service.updateState({
        repetitions: 5,
        sprintTime: sToMs(seconds(15)),
        recoveryTime: sToMs(seconds(30)),
      });
      expect(service.repetitions()).toEqual(5);
      expect(service.sprintTime()).toEqual(15000);
      expect(service.recoveryTime()).toEqual(30000);
    });

    it('should handle partial updates', () => {
      service.updateState({ sprintTime: sToMs(seconds(20)) });
      expect(service.sprintTime()).toEqual(20000);
      expect(service.repetitions()).toEqual(4); // default value
      expect(service.recoveryTime()).toEqual(60000); // default value
    });

    it('should save', () => {
      service.updateState({ repetitions: 3 });
      TestBed.flushEffects();
      expect(repositoryFactoryMock.repository?.savedData).toEqual({
        repetitions: 3,
        sprintTime: 10000,
        recoveryTime: 60000,
      });
    });
  });

  describe('with saved data', () => {
    it('should load from repository if data exists', () => {
      initTest({
        repetitions: 6,
        sprintTime: sToMs(seconds(12)),
        recoveryTime: sToMs(seconds(45)),
      });

      expect(service.repetitions()).toEqual(6);
      expect(service.sprintTime()).toEqual(12000);
      expect(service.recoveryTime()).toEqual(45000);
    });
  });
});
