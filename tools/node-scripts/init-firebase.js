const os = require('os');
const admin = require('firebase-admin');
const serviceAccount = require(os.homedir() + '/.firebase/angularexamples-b69f4-firebase-adminsdk-lz4i3-a8dd3e2808.json');
const defaultShaders = require('../admin/default-shaders.v2').defaultShaders;

const initBaseData = require('../admin/base-data.v1').initBaseData;

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
