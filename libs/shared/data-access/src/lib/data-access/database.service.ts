import { inject, Injectable } from '@angular/core';
import { collection, Firestore } from '@angular/fire/firestore';
import { type CollectionReference } from './database-types';
import { Repo } from './repo.service';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private readonly firestore = inject(Firestore);

  createRepo<T>(path: string): Repo<T> {
    return new Repo<T>(this.collection(path));
  }

  // delegate all calls to firestore
  private collection<T>(path: string): CollectionReference<T> {
    return collection(this.firestore, path) as CollectionReference<T>;
  }
}
