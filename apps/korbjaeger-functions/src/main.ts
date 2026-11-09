/**
 * Korbjäger's Cloud Functions (codebase `konto` in
 * `firebase.korbjaeger.json`, `korbjaeger-functions:deploy`); the app's DBB
 * proxy is the Nitro function of codebase `default`, deployed with the app.
 */
import {
  DBB_BASE_URL,
  DbbBasketballData,
} from '@wolsok/feat-shared-basketball-data';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import * as v1 from 'firebase-functions/v1';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { directDbbTransport } from './club-index/dbb-transport';
import { firestoreClubIndex } from './club-index/firestore-club-index';
import { runClubIndex } from './club-index/run-club-index';
import {
  CLUB_INDEX_DBB,
  CLUB_INDEX_ON,
  CLUB_INDEX_SCHEDULE,
  REGION,
} from './config';
import { kontoGeloescht } from './konto-geloescht';

initializeApp();

/**
 * Deletes a deleted account's Auswahl (#2912, ADR 0019). 1st gen, as 2nd-gen
 * functions have no Auth deletion event. Retried until it succeeds (Cloud
 * Functions gives up after `DELETION_RETRY_DAYS` of the account lib), which
 * `kontoGeloescht` allows: a rerun ends the same.
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

/**
 * The club index (#2988): hourly, it crawls the one Association whose list
 * is missing or a week old (`runClubIndex`; one whose crawl failed waits a
 * day, so it holds up no other) from the DBB's public Leagues,
 * one request a second, and stores its Clubs' ids and names in `clubIndex`,
 * which the app's `/api/clubs` serves. Not retried: the next hour picks the
 * same Association again. Its log names no Club. Off with `CLUB_INDEX_ON`.
 */
export const clubIndex = CLUB_INDEX_ON
  ? onSchedule(
      {
        schedule: '23 * * * *',
        timeZone: 'UTC',
        region: REGION,
        memory: '512MiB',
        timeoutSeconds: 1800,
        maxInstances: 1,
        retryCount: 0,
      },
      async () => {
        const result = await runClubIndex({
          data: new DbbBasketballData(
            directDbbTransport({
              baseUrl: DBB_BASE_URL,
              fetch,
              timeoutMs: CLUB_INDEX_DBB.timeoutMs,
              userAgent: CLUB_INDEX_DBB.userAgent,
            })
          ),
          store: firestoreClubIndex(getFirestore()),
          now: Date.now,
          pause: () =>
            new Promise((resolve) =>
              setTimeout(resolve, CLUB_INDEX_DBB.pauseMs)
            ),
          schedule: CLUB_INDEX_SCHEDULE,
        });
        logger.info('Club index run', result);
      }
    )
  : undefined;
