package de.wolsok.bacteriawars;

import android.app.Application;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * Starts the Play Games Services SDK with the app. On every launch it signs
 * the player in to Play Games against the game project named by
 * {@code com.google.android.gms.games.APP_ID} in the manifest, silently: the
 * SDK shows its welcome popup over the app's own activity, which has handed
 * over to Chrome by then. Nothing reads the sign-in yet; it puts the game into
 * the player's Play Games library and is the ground for achievements later.
 * The SDK only registers for activity callbacks here, so a process Chrome
 * starts for the Digital Goods services costs nothing more.
 */
public class BacteriaWarsApplication extends Application {
  @Override
  public void onCreate() {
    super.onCreate();
    PlayGamesSdk.initialize(this);
  }
}
