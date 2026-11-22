package de.wolsok.bacteriawars;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import com.google.android.gms.games.GamesSignInClient;
import com.google.android.gms.games.PlayGames;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * The app's launcher: hands the game the player's Play Games sign-in
 * (#3175). It holds Chrome back until Play Games has said whether the
 * player is signed in (the silent sign-in {@link BacteriaWarsApplication}
 * starts) and, if so, asks for a one-time server auth code for the game's
 * web OAuth client, which the game sends to its functions: they link the
 * Play Games player to the game account and sign the game in to it. The
 * code goes in the launch URL's fragment ({@code #play-games=<code>}),
 * which no server sees; the game takes it out of the address at once.
 *
 * <p>Chrome starts the moment Play Games answers, and at once when it
 * cannot answer; {@link #MAX_WAIT_MS} is only the worst case. A link that
 * carries a fragment of its own ({@code #friend=…}) starts unchanged.
 */
public class PlayGamesLauncherActivity extends LauncherActivity {
  /** The longest the launch waits for Play Games. */
  private static final long MAX_WAIT_MS = 3000;
  /** The fragment key the game reads the code from (`PLAY_GAMES_FRAGMENT_KEY`). */
  private static final String FRAGMENT_KEY = "play-games";

  private final Handler handler = new Handler(Looper.getMainLooper());
  @Nullable private String serverAuthCode;
  private boolean launched;

  @Override
  protected boolean shouldLaunchImmediately() {
    return false;
  }

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Back from Chrome, the activity only finishes (see LauncherActivity).
    if (isFinishing()) {
      return;
    }
    handler.postDelayed(() -> launchWith(null), MAX_WAIT_MS);
    GamesSignInClient signIn = PlayGames.getGamesSignInClient(this);
    signIn
        .isAuthenticated()
        .addOnCompleteListener(
            authenticated -> {
              if (!authenticated.isSuccessful()
                  || !authenticated.getResult().isAuthenticated()) {
                launchWith(null);
                return;
              }
              signIn
                  .requestServerSideAccess(
                      getString(R.string.default_web_client_id), false)
                  .addOnCompleteListener(
                      code -> launchWith(code.isSuccessful() ? code.getResult() : null));
            });
  }

  @Override
  protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    super.onDestroy();
  }

  /** Starts Chrome once, with the code where there is one. */
  private void launchWith(@Nullable String code) {
    if (launched || isFinishing()) {
      return;
    }
    launched = true;
    handler.removeCallbacksAndMessages(null);
    serverAuthCode = code;
    launchTwa();
  }

  @Override
  protected Uri getLaunchingUrl() {
    Uri url = super.getLaunchingUrl();
    if (serverAuthCode == null || url.getFragment() != null) {
      return url;
    }
    return url.buildUpon()
        .encodedFragment(FRAGMENT_KEY + "=" + Uri.encode(serverAuthCode))
        .build();
  }
}
