import { getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Database, getDatabase } from 'firebase-admin/database';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

/**
 * The Admin SDK of the project the functions run in - no project id, so the
 * emulator's demo project and production use the same code. Started on
 * first use, so loading the module costs nothing.
 */
function app() {
  return getApps()[0] ?? initializeApp();
}

/** The project's Firestore. */
export function db(): Firestore {
  return getFirestore(app());
}

/** The project's Auth. */
export function auth(): Auth {
  return getAuth(app());
}

/**
 * The project's Realtime Database - its URL comes from `FIREBASE_CONFIG`,
 * which Cloud Functions and the emulator set.
 */
export function rtdb(): Database {
  return getDatabase(app());
}
