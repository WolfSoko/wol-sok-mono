/**
 * Set where signing out could not clear Firestore's copy on the device
 * (another tab held it, or clearing failed): the next start clears it,
 * signed in or not. Kept apart from Firebase's chunk, so the start reads
 * it without loading Firebase.
 */
export const ZWISCHENSPEICHER_LEEREN_SCHLUESSEL =
  'korbjaeger-zwischenspeicher-leeren';
