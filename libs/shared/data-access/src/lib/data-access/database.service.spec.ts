import { TestBed } from '@angular/core/testing';
import { collection, Firestore } from '@angular/fire/firestore';
import { SpectatorService } from '@ngneat/spectator';
import { createServiceFactory } from '@ngneat/spectator/jest';

import { DatabaseService } from './database.service';
import { Repo } from './repo.service';

jest.mock('@angular/fire/firestore', () => ({
  ...jest.requireActual('@angular/fire/firestore'),
  collection: jest.fn(),
}));
describe('DatabaseService', () => {
  let spectator: SpectatorService<DatabaseService>;
  const createService = createServiceFactory({
    service: DatabaseService,
    providers: [],
    entryComponents: [],
    mocks: [Firestore],
  });

  beforeEach(() => (spectator = createService()));

  it('should be created', () => {
    expect(spectator.service).toBeTruthy();
  });

  describe('createRepo method', () => {
    it('should call firebase collection', () => {
      spectator.service.createRepo('testPath');
      const firestore = TestBed.inject(Firestore);
      expect(collection as unknown).toHaveBeenCalledWith(firestore, 'testPath');
    });

    it('should return the repo', () => {
      const colRefResult = { test: 'test123' };
      (collection as jest.Mock).mockReturnValue(colRefResult);
      const repo: Repo<unknown> = spectator.service.createRepo('testPath');
      expect(repo).toBeInstanceOf(Repo);
    });
  });
});
