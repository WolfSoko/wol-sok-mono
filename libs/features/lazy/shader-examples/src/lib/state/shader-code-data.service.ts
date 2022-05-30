import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  Firestore,
  getDocs,
  query,
  QueryConstraint,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { AuthenticationService, AuthQuery } from '@wolsok/feat-api-auth';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ShaderCode } from './shader-code.model';

@Injectable({
  providedIn: 'root',
})
export class ShaderCodeDataService {
  private shaders?: Observable<ShaderCode[]>;

  private readonly userShaders$: Observable<ShaderCode[]>;
  private readonly defaultShaders$: Observable<ShaderCode[]>;

  constructor(
    private firestore: Firestore,
    private authentication: AuthenticationService,
    private authQuery: AuthQuery
  ) {
    this.defaultShaders$ = this.observeShaderCollection(
      '/angularExamples/shaderExamples/defaultShaders'
    );

    this.userShaders$ = this.observeShaderCollection(
      `angularExamples/shaderExamples/${this.userUid()}`
    );
  }

  private observeShaderCollection(
    shaderCollectionPath: string,
    ...queryConstraints: QueryConstraint[]
  ): Observable<ShaderCode[]> {
    const shaderColRef = this.createCollectionRef(shaderCollectionPath);
    return collectionData<ShaderCode>(query(shaderColRef, ...queryConstraints));
  }

  private createCollectionRef(
    shaderCollectionPath: string
  ): CollectionReference<ShaderCode> {
    return collection(
      this.firestore,
      shaderCollectionPath
    ) as CollectionReference<ShaderCode>;
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
      this.shaders = combineLatest([
        this.defaultShaders$,
        this.userShaders$,
      ]).pipe(mapDefaultAndUserShaders, shareReplay(1));
    }
    return this.shaders;
  }

  async updateShader(
    shader: ShaderCode,
    changedShader: Partial<ShaderCode>
  ): Promise<ShaderCode> {
    const shaderByIdQuery = this.createCollectionRef(
      `angularExamples/shaderExamples/${this.userUid()}`
    );

    const shaderToUpdateDocRef = (
      await getDocs(query(shaderByIdQuery, where('id', '==', shader.id)))
    ).docs[0]?.ref;

    const newShader = { ...shader, ...changedShader };
    if (shaderToUpdateDocRef == null) {
      await addDoc(shaderByIdQuery, newShader);
      return newShader;
    }
    await updateDoc(shaderToUpdateDocRef, newShader);
    return newShader;
  }

  private userUid() {
    return this.authQuery.profile?.uid;
  }
}
