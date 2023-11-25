import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { ShaderCode } from '../model/shader-code.model';

export type ShaderCodeState = EntityState<ShaderCode>;

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'shader-code' })
export class ShaderCodeStore extends EntityStore<ShaderCodeState, ShaderCode> {
  constructor() {
    super();
  }
}
