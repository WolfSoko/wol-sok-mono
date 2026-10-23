package de.wolsok.bacteriawars;

import android.app.Application;
import com.google.android.gms.games.PlayGamesSdk;

/**
 * Starts the Play Games Services SDK with the app: it signs the player in to
 * Play Games on its own on every launch, against the game project named by
 * {@code com.google.android.gms.games.APP_ID} in the manifest.
 */
public class BacteriaWarsApplication extends Application {
  @Override
  public void onCreate() {
    super.onCreate();
    PlayGamesSdk.initialize(this);
  }
}
