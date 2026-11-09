# feat-korbjaeger-collections

The names of Korbjäger's Firestore collections, in one place for the app,
its Auswahl lib, its Cloud Functions (`korbjaeger-functions`) and the
emulator specs ([#2945](https://github.com/WolfSoko/wol-sok-mono/issues/2945)).
It imports nothing, so the functions bundle it without Angular or the web
SDK, and a change to the Auswahl lib does not redeploy the functions.
`firestore.rules` and `firestore.indexes.json` cannot import it; the app's
specs check them against these names.
