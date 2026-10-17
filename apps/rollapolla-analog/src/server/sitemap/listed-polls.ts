import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  Firestore,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore/lite';
import type { PollDto } from '../../app/adapter/poll.dto';
import { environment } from '../../environments/environment';
import { SitemapPoll } from './sitemap';

/** Sitemaps take up to 50,000 URLs; the newest polls are the ones worth it. */
const MAX_POLLS = 1000;

/** A slow Firestore must not hold up the sitemap, the fallback is better. */
const TIMEOUT_MS = 5000;

const APP_NAME = 'sitemap';

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
  const snapshot = await withTimeout(getDocs(polls), TIMEOUT_MS);
  // one malformed poll must not cost the sitemap all the others
  return snapshot.docs.flatMap((doc) => {
    const { ttl } = doc.data() as Partial<Pick<PollDto, 'ttl'>>;
    return ttl ? [{ id: doc.id, closesAt: ttl.toDate() }] : [];
  });
}

/** Its own app, so it never clashes with the one the SSR renderer starts. */
function db(): Firestore {
  const existing = getApps().find(({ name }) => name === APP_NAME);
  if (existing) {
    return getFirestore(existing);
  }
  const firestore = getFirestore(
    initializeApp(environment.dataAccessOptions, APP_NAME)
  );
  if (!environment.prod) {
    connectFirestoreEmulator(firestore, 'localhost', 8080);
  }
  return firestore;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${ms} ms`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
