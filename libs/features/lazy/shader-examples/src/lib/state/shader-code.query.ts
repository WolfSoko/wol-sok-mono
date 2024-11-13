import { Injectable } from '@angular/core';
import { Order, QueryEntity } from '@datorama/akita';
import { ShaderCode } from '../model/shader-code.model';
import { ShaderCodeState, ShaderCodeStore } from './shader-code.store';

@Injectable({
  providedIn: 'root',
})
export class ShaderCodeQuery extends QueryEntity<ShaderCodeState, ShaderCode> {
  constructor(store: ShaderCodeStore) {
    super(store);
  }

  public getAllSortedById(): ShaderCode[] {
    return this.getAll({ sortBy: 'id', sortByOrder: Order.DESC });
  }
}
