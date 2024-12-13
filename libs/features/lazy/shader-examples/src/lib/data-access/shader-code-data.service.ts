import { inject, Injectable } from '@angular/core';
import { AuthFacade } from '@wolsok/feat-api-auth';
import { DatabaseService, Repo } from '@wolsok/shared-data-access';
import { combineLatest, Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ShaderCode } from '../model/shader-code.model';

@Injectable({ providedIn: 'root' })
export class ShaderCodeDataService {
  private readonly profile = inject(AuthFacade).profile;
  private readonly db: DatabaseService = inject(DatabaseService);

  private shaders?: Observable<ShaderCode[]>;
  private readonly userShaders$ = this.observeShaderCollection(
    `angularExamples/shaderExamples/${this.userUid()}`
  );
  private readonly defaultShaders$ = this.observeShaderCollection(
    '/angularExamples/shaderExamples/defaultShaders'
  );

  private observeShaderCollection(
    shaderCollectionPath: string
  ): Observable<ShaderCode[]> {
    const shaderColRef = this.getShaderCollection(shaderCollectionPath);
    return shaderColRef.data$();
  }

  private getShaderCollection(shaderCollectionPath: string): Repo<ShaderCode> {
    return this.db.createRepo<ShaderCode>(shaderCollectionPath);
  }

  streamShaders(): Observable<ShaderCode[]> {
    if (this.shaders == null) {
      const mapDefaultAndUserShaders = map(
        ([defaults, users]: [ShaderCode[], ShaderCode[]]) =>
          defaults.map((defaultShader) => {
            const shaderCode = users.find((sha) => sha.id === defaultShader.id);
            return shaderCode != null ? shaderCode : defaultShader;
          })
      );
      this.shaders = combineLatest([this.defaultShaders$, of([])]).pipe(
        mapDefaultAndUserShaders,
        shareReplay(1)
      );
    }
    return this.shaders;
  }

  async updateShader(
    shader: ShaderCode,
    changedShader: Partial<ShaderCode>
  ): Promise<ShaderCode> {
    const shaderByIdRepo = this.getShaderCollection(
      `angularExamples/shaderExamples/${this.userUid()}`
    );

    const shaderToUpdateDocRef = await shaderByIdRepo.queryFirst(
      'id',
      '==',
      shader.id
    );

    const newShader = { ...shader, ...changedShader };
    if (shaderToUpdateDocRef == null) {
      await shaderByIdRepo.addDoc(newShader);
      return newShader;
    }
    await shaderByIdRepo.updateDoc(shaderToUpdateDocRef, newShader);
    return newShader;
  }

  private userUid() {
    return this.profile()?.uid;
  }
}
