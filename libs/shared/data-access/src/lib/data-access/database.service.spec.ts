import { TestBed } from '@angular/core/testing';
import { collection, Firestore } from '@angular/fire/firestore';
import { MockedObject } from '@storybook/test';
import { vi } from 'vitest';

import { DatabaseService } from './database.service';
import { Repo } from './repo.service';

vi.mock('@angular/fire/firestore', async () => ({
  Firestore: vi.fn(),
  collection: vi.fn(),
}));
describe('DatabaseService', () => {
  let firestoreMock: MockedObject<Firestore>;
  let service: DatabaseService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DatabaseService,
        { provide: Firestore, useValue: firestoreMock },
      ],
    });
    service = TestBed.inject(DatabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createRepo method', () => {
    it('should call firebase collection', () => {
      service.createRepo('testPath');
      const firestore = TestBed.inject(Firestore);
      expect(collection).toHaveBeenCalledWith(firestore, 'testPath');
    });

    it('should return the repo', () => {
      const colRefResult = {
        test: 'test123',
      } as never;
      vi.mocked(collection).mockReturnValue(colRefResult);
      const repo: Repo<unknown> = service.createRepo('testPath');
      expect(repo).toBeInstanceOf(Repo);
    });
  });
});
