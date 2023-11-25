import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { ShaderCode } from '../model/shader-code.model';
import { ShaderCodeStore, ShaderCodeState } from './shader-code.store';

@Injectable({
  providedIn: 'root',
})
export class ShaderCodeQuery extends QueryEntity<ShaderCodeState, ShaderCode> {
  constructor(store: ShaderCodeStore) {
    super(store);
  }

  public getAllSortedById(): ShaderCode[] {
    return this.getAll({ sortBy: 'id' });
  }
}
