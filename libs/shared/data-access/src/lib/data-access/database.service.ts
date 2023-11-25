import { Injectable } from '@angular/core';
import { collection, CollectionReference, Firestore } from '@angular/fire/firestore';
export {
  addDoc,
  collectionData,
  CollectionReference,
  Firestore,
  getDocs,
  query,
  QueryConstraint,
  updateDoc,
  where,
} from '@angular/fire/firestore';

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
