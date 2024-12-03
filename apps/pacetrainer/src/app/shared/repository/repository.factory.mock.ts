import { Injectable } from '@angular/core';
import { Repository } from './repository';
import { RepositoryFactory } from './repository.factory';
import { JSONCompatible } from '../utils/json-utils/json-utils';

@Injectable({
  providedIn: 'root',
})
export class RepositoryFactoryMock<
  RType extends JSONCompatible<RType>,
> extends RepositoryFactory {
  key = 'sprint-training-data';
  repository?: RepositoryMock<RType>;
  initialData?: RType;

  override create<T extends JSONCompatible<T> = RType>(
    key: string
  ): RepositoryMock<T> {
    this.key = key;
    const repositoryMock = new RepositoryMock<T>();
    if (this.initialData) {
      repositoryMock.savedData = this.initialData as unknown as T;
    }
    this.repository = repositoryMock as unknown as Repository<RType>;
    return repositoryMock;
  }
}

export class RepositoryMock<T extends JSONCompatible<T>> extends Repository<T> {
  savedData?: T;

  constructor() {
    super('mock');
  }

  override save(data: T): void {
    this.savedData = data;
  }

  override load(): T | null {
    return this.savedData ?? null;
  }
}
