import {
  addDoc,
  collectionData,
  type DocumentData,
  type DocumentReference,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { type Observable } from 'rxjs';
import { type CollectionReference } from './database-types';

export class Repo<T> {
  constructor(private readonly col: CollectionReference<T>) {}

  data$(): Observable<T[]> {
    return collectionData(this.col);
  }

  async addDoc(data: Omit<T, 'id'>): Promise<DocumentReference<T>> {
    return (await addDoc(this.col, data)) as DocumentReference<T>;
  }

  async updateDoc(
    ref: DocumentReference<T>,
    data: T extends DocumentData ? T : Partial<T>
  ): Promise<DocumentReference<T>> {
    await updateDoc(ref, data);
    return ref;
  }

  async queryFirst(
    ...whereParams: Parameters<typeof where>
  ): Promise<DocumentReference<T> | undefined> {
    return (await this.query(...whereParams))[0];
  }

  async query(
    ...whereParams: Parameters<typeof where>
  ): Promise<DocumentReference<T>[]> {
    return (await getDocs(query(this.col, where(...whereParams)))).docs.map(
      (snapshot) => snapshot.ref
    );
  }
}
