import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  Firestore,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore/lite';
import { environment } from '../../environments/environment';
import { SitemapPoll } from './sitemap';

/** Sitemaps take up to 50,000 URLs; the newest polls are the ones worth it. */
const MAX_POLLS = 1000;

const APP_NAME = 'sitemap';

let firestore: Firestore | undefined;

/**
 * Reads the newest listed polls the way any visitor can (the rules let
 * everyone list `listed == true`), so the server needs no credentials. In
 * development mode vite.config.ts swaps in environment.develop, which points
 * at the Firestore emulator, as the browser does.
 */
export async function listedPolls(): Promise<SitemapPoll[]> {
  const polls = query(
    collection(db(), 'polls'),
    where('listed', '==', true),
    orderBy('createdAt', 'desc'),
    limit(MAX_POLLS)
  );
  const snapshot = await getDocs(polls);
  return snapshot.docs.map((doc) => {
    const data = doc.data() as { createdAt: Timestamp; ttl: Timestamp };
    return {
      id: doc.id,
      createdAt: data.createdAt.toDate(),
      closesAt: data.ttl.toDate(),
    };
  });
}

function db(): Firestore {
  if (!firestore) {
    // its own app, so it never clashes with the one the SSR renderer starts
    const app = getApps().some(({ name }) => name === APP_NAME)
      ? getApp(APP_NAME)
      : initializeApp(environment.dataAccessOptions, APP_NAME);
    firestore = getFirestore(app);
    if (!environment.prod) {
      connectFirestoreEmulator(firestore, 'localhost', 8080);
    }
  }
  return firestore;
}
