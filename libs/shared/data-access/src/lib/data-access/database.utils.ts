import { Injectable } from '@angular/core';
import {
  addDoc,
  collectionData,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class DbUtils {
  addDoc: typeof addDoc = addDoc;
  collectionData: typeof collectionData = collectionData;
  getDocs: typeof getDocs = getDocs;
  query: typeof query = query;
  updateDoc: typeof updateDoc = updateDoc;
  where: typeof where = where;
}
