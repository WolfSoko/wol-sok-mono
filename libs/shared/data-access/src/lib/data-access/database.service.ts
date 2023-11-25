import { Injectable } from '@angular/core';
import { collection, Firestore } from '@angular/fire/firestore';
import { CollectionReference } from './database-types';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  constructor(private readonly firestore: Firestore) {}

  // delegate all calls to firestore
  collection<T>(path: string): CollectionReference<T> {
    return collection(this.firestore, path) as CollectionReference<T>;
  }
}
