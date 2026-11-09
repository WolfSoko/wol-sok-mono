/**
 * Korbjäger's Cloud Functions (codebase `konto` in
 * `firebase.korbjaeger.json`, `korbjaeger-functions:deploy`); the app's DBB
 * proxy is the Nitro function of codebase `default`, deployed with the app.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import * as v1 from 'firebase-functions/v1';
import { REGION } from './config';
import { kontoGeloescht } from './konto-geloescht';

initializeApp();

/**
 * Deletes a deleted account's Auswahl (#2912, ADR 0019). 1st gen, as 2nd-gen
 * functions have no Auth deletion event. Retried until it succeeds (Cloud
 * Functions gives up after 7 days), which `kontoGeloescht` allows: a rerun
 * ends the same.
 */
export const auswahlLoeschen = v1
  .region(REGION)
  .runWith({ failurePolicy: true })
  .auth.user()
  .onDelete(async (user) => {
    await kontoGeloescht(getFirestore(), user.uid);
    // no uid: Cloud Logging keeps it 30 days, the privacy policy promises one
    logger.info('Auswahl of a deleted account deleted');
  });
