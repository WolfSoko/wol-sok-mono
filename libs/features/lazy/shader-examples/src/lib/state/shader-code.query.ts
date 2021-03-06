import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { ShaderCodeStore, ShaderCodeState } from './shader-code.store';
import { ShaderCode } from './shader-code.model';

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
