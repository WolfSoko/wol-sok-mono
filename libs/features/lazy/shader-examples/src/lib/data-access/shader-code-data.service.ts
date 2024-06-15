import { Injectable } from '@angular/core';
import { AuthenticationService, AuthQuery } from '@wolsok/feat-api-auth';
import {
  CollectionReference,
  DatabaseService,
  DbUtils,
  QueryConstraint,
  Repo,
} from '@wolsok/shared-data-access';
import { combineLatest, Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ShaderCode } from '../model/shader-code.model';

@Injectable({ providedIn: 'root' })
export class ShaderCodeDataService {
  private shaders?: Observable<ShaderCode[]>;

  private readonly userShaders$: Observable<ShaderCode[]>;
  private readonly defaultShaders$: Observable<ShaderCode[]>;

  constructor(
    private db: DatabaseService,
    private authentication: AuthenticationService,
    private authQuery: AuthQuery,
    private dbUtils: DbUtils
  ) {
    this.defaultShaders$ = this.observeShaderCollection(
      '/angularExamples/shaderExamples/defaultShaders'
    );
    this.userShaders$ = this.observeShaderCollection(
      `angularExamples/shaderExamples/${this.userUid()}`
    );
  }

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
    return this.authQuery.profile?.uid;
  }
}
