import {
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
} from '@angular/fire/firestore';
import { onSnapshot } from 'firebase/firestore';
import { map, Observable } from 'rxjs';

/*
 * The SDK's `onSnapshot` as an Observable. Not AngularFire's `docData` or
 * `collectionData`: on the server those keep rendering waiting until Firestore
 * answers, however long it takes. Callers decide how long to wait (see
 * pendingUntilFirstValue).
 */

export function docSnapshots<T>(
  ref: DocumentReference<T>
): Observable<DocumentSnapshot<T>> {
  return new Observable((subscriber) =>
    onSnapshot(
      ref,
      (snapshot) => subscriber.next(snapshot),
      (error) => subscriber.error(error)
    )
  );
}

export function querySnapshots<T>(
  query: Query<T>
): Observable<QuerySnapshot<T>> {
  return new Observable((subscriber) =>
    onSnapshot(
      query,
      (snapshot) => subscriber.next(snapshot),
      (error) => subscriber.error(error)
    )
  );
}

/** The documents of each snapshot, converted. */
export function queryData<T>(query: Query<T>): Observable<T[]> {
  return querySnapshots(query).pipe(
    map((snapshot) => snapshot.docs.map((document) => document.data()))
  );
}
