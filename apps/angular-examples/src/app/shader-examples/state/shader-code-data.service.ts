import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/firestore';
import { combineLatest, Observable } from 'rxjs';
import { map, shareReplay, take, tap } from 'rxjs/operators';
import { AuthenticationService, AuthQuery } from '../../core';
import { ShaderCode } from './shader-code.model';

@Injectable({
  providedIn: 'root',
})
export class ShaderCodeDataService {
  private shaders?: Observable<ShaderCode[]>;

  private readonly userShadersCol: AngularFirestoreCollection<ShaderCode>;
  private readonly defaultShadersCol: AngularFirestoreCollection<ShaderCode>;

  constructor(
    private afs: AngularFirestore,
    private authentication: AuthenticationService,
    private authQuery: AuthQuery
  ) {
    this.defaultShadersCol = this.afs.collection<ShaderCode>(
      '/angularExamples/shaderExamples/defaultShaders',
      (ref) => ref.orderBy('id')
    );

    this.userShadersCol = this.afs.collection<ShaderCode>(
      `angularExamples/shaderExamples/${this.userUid()}`,
      (ref) => ref.orderBy('id')
    );
  }

  streamShaders(): Observable<ShaderCode[]> {
    if (this.shaders == null) {
      const defaultShaders = this.defaultShadersCol.valueChanges();
      const userShaders: Observable<ShaderCode[]> = (
        this.userShadersCol.stateChanges(['added'])
      ).pipe(
        map((documentChanges) =>
          documentChanges.map((change) => change.payload.doc.data())
        )
      );

      const mapDefaultAndUserShaders = map(
        ([defaults, users]: [ShaderCode[], ShaderCode[]]) =>
          defaults.map((defaultShader) => {
            const shaderCode = users.find((sha) => sha.id === defaultShader.id);
            return shaderCode != null ? shaderCode : defaultShader;
          })
      );
      this.shaders = combineLatest([defaultShaders, userShaders]).pipe(
        mapDefaultAndUserShaders,
        shareReplay(1)
      );
    }
    return this.shaders;
  }

  async updateShader(shader: ShaderCode, newCode: string) {
    const shaderByIdQuery = this.afs.collection<ShaderCode>(
      `angularExamples/shaderExamples/${this.userUid()}`,
      (ref) => ref.where('id', '==', shader.id)
    );
    const newShader = { ...shader, ...{ code: newCode } };

    const deleteOldShadersAndUpdateInBatch = (
      shaderByIdQuery.get({})
    ).pipe(
      take(1),
      tap((ref) => ref.docs.forEach((doc) => doc.ref.delete())),
      tap((_) => {
        const newUid = this.afs.createId();
        const firestoreDocument = this.afs.doc(
          `angularExamples/shaderExamples/${this.userUid()}/${newUid}`
        );
        firestoreDocument.ref.set(newShader);
      })
    );

    return deleteOldShadersAndUpdateInBatch.toPromise();
  }

  private userUid() {
    return this.authQuery.profile?.uid;
  }
}
