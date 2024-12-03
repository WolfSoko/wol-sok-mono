import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideRepositoryMock } from '../repository/provide-repository.mock';
import { RepositoryFactoryMock } from '../repository/repository.factory.mock';
import { TrainingRunnerService } from './training-runner.service';
import { TrainingRunnerState } from './training-runner.state';

describe('TrainingRunnerService', () => {
  let service: TrainingRunnerService;

  function initService(): void {
    service = TestBed.inject(TrainingRunnerService);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        provideRepositoryMock(),
      ],
    });
  });

  describe('clean start', () => {
    beforeEach(() => {
      initService();
    });

    it('should be created with initial state "stopped"', () => {
      expect(service.trainingState()).toBe('stopped');
    });

    it('should toggle training state to "running" from "stopped"', () => {
      service.toggleTraining();
      expect(service.trainingState()).toBe('running');
    });

    it('should toggle training state to "paused" from "running"', () => {
      service.toggleTraining(); // First toggle to "running"
      service.toggleTraining(); // Second toggle to "paused"
      expect(service.trainingState()).toBe('paused');
    });

    it('should end training and set state to "stopped"', () => {
      service.toggleTraining(); // Set to "running"
      service.endTraining();
      expect(service.trainingState()).toBe('stopped');
    });

    it('should remain "stopped" when endTraining is called while stopped', () => {
      service.endTraining();
      expect(service.trainingState()).toBe('stopped');
    });

    it('should toggle correctly between states', () => {
      service.toggleTraining(); // "stopped" -> "running"
      expect(service.trainingState()).toBe('running');
      service.toggleTraining(); // "running" -> "paused"
      expect(service.trainingState()).toBe('paused');
      service.toggleTraining(); // "paused" -> "running"
      expect(service.trainingState()).toBe('running');
    });
  });

  describe('fetching data', () => {
    beforeEach(() => {
      TestBed.inject(RepositoryFactoryMock<TrainingRunnerState>).initialData =
        'running';
      initService();
    });

    it('should load initial state from repo', () => {
      expect(service.trainingState()).toEqual('running');
    });
  });
});
