import { Injectable } from '@angular/core';
import { ShaderCodeDataService } from '../data-access/shader-code-data.service';
import { ShaderCode } from '../model/shader-code.model';

import { ShaderCodeStore } from './shader-code.store';

@Injectable({
  providedIn: 'root',
})
export class ShaderCodeService {
  constructor(
    private shaderCodeStore: ShaderCodeStore,
    private shaderCodeDataService: ShaderCodeDataService
  ) {}

  get() {
    this.shaderCodeDataService
      .streamShaders()
      .subscribe((entities: ShaderCode[]) => {
        this.shaderCodeStore.set(entities);
      });
  }

  async update(shader: ShaderCode, code: string, permanent = false) {
    this.shaderCodeStore.update(shader.id, { code });
    if (permanent) {
      await this.shaderCodeDataService.updateShader(shader, { code });
    }
  }
}
