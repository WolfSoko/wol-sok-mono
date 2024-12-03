import { Provider } from '@angular/core';
import { RepositoryFactory } from './repository.factory';
import { RepositoryFactoryMock } from './repository.factory.mock';

export function provideRepositoryMock(): Provider[] {
  return [
    { provide: RepositoryFactory, useClass: RepositoryFactoryMock },
    { provide: RepositoryFactoryMock, useExisting: RepositoryFactory },
  ];
}
