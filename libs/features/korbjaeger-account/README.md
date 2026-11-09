# feat-shared-korbjaeger-account

What Korbjäger's app and its Cloud Functions (`korbjaeger-functions`) both
know about an account's data: where the Firestore database lies, the names
of its collections and how long a deleted account's traces stay. Plain
constants, no Firebase, Angular or DOM, so the functions' bundle can take
it.

Files that cannot import it (`apps/korbjaeger/firestore.rules`,
`firestore.indexes.json`, the functions' deploy command) are checked against
it by specs in the apps.

Run its specs with `npx nx test feat-shared-korbjaeger-account`.
