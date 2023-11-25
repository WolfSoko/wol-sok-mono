import { Injectable } from '@angular/core';
import { addDoc, collectionData, getDocs, query, updateDoc, where } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class DbUtils {
  addDoc = addDoc;
  collectionData = collectionData;
  getDocs = getDocs;
  query = query;
  updateDoc = updateDoc;
  where = where;
}
