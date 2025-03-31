import os from 'os';
import admin from 'firebase-admin';
const serviceAccount = (
  await import(
    os.homedir() +
      '/.firebase/angularexamples-b69f4-firebase-adminsdk-lz4i3-a8dd3e2808.json'
  )
).default;

import defaultShaders from '../admin/default-shaders.v2';

import { initBaseData } from '../admin/base-data.v1';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://angularexamples-b69f4.firebaseio.com',
});

const db = admin.firestore();

async function writeDefaultData() {
  return await initBaseData(db, defaultShaders);
}

writeDefaultData().then(
  (ignored) => console.log('initialized firestore'),
  (error) => {
    console.error('error initializing firestore', error);
    throw error;
  }
);
