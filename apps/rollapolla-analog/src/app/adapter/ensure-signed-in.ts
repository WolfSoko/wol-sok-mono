import {
  Auth,
  GoogleAuthProvider,
  signInAnonymously,
  updateProfile,
  User,
} from '@angular/fire/auth';

/** The signed-in user, signing in anonymously first if nobody is. */
export async function ensureSignedIn(auth: Auth): Promise<User> {
  await auth.authStateReady();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

/**
 * Linking an anonymous account to Google keeps its empty profile, so neither
 * `displayName` nor the sign-in token's `name` claim carry the Google name.
 * Copies name and photo over and refreshes the token, once. Never throws.
 */
export async function adoptGoogleProfile(user: User): Promise<User> {
  const google = user.providerData.find(
    (profile) => profile.providerId === GoogleAuthProvider.PROVIDER_ID
  );
  if (!google?.displayName || user.displayName) {
    return user;
  }
  const photoURL = user.photoURL ?? google.photoURL;
  try {
    await updateProfile(user, {
      displayName: google.displayName,
      ...(photoURL ? { photoURL } : {}),
    });
    await user.getIdToken(true);
  } catch (error) {
    // not worth failing for: the visitor just stays nameless a while longer
    console.error('Could not copy the Google profile', error);
  }
  return user;
}
