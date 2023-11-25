import { TestBed } from '@angular/core/testing';
import { collection, Firestore } from '@angular/fire/firestore';
import { SpectatorService } from '@ngneat/spectator';
import { createServiceFactory } from '@ngneat/spectator/jest';

import { DatabaseService } from './database.service';

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

  describe('collection method', () => {
    it('should call firebase collection', () => {
      spectator.service.collection('testPath');
      const firstore = TestBed.inject(Firestore);
      expect(collection as unknown).toHaveBeenCalledWith(firstore, 'testPath');
    });

    it('should return the collectionRef', () => {
      const colRefResult = { test: 'test123' };
      (collection as jest.Mock).mockReturnValue(colRefResult);
      const collectionReference: unknown = spectator.service.collection('testPath');
      expect(collectionReference).toEqual(colRefResult);
    });
  });
});
