import groovy.json.JsonSlurper

plugins {
  id("com.android.application")
}

// The app is a Trusted Web Activity: Chrome shows the game from this host
// fullscreen, once the host's /.well-known/assetlinks.json names the key the
// app is signed with (apps/bacteria-game-remote/src/.well-known).
val host = "bacteria-game.wolsok.de"
val launchUrl = "https://$host/"
val backgroundColor = "#060e19"

// The app follows the workspace release: 74.44.1 becomes version code
// 74044001, so every release counts up.
val release = (JsonSlurper().parse(rootDir.resolve("../../version.json")) as Map<*, *>)["version"] as String
val (major, minor, patch) = release.split(".").map(String::toInt)

// Release builds are signed only when a key is configured, see README.md.
val keystoreFile: String? = System.getenv("ANDROID_KEYSTORE_FILE")

android {
  namespace = "de.wolsok.bacteriagame"
  compileSdk = 37

  defaultConfig {
    applicationId = "de.wolsok.bacteriagame"
    minSdk = 24
    targetSdk = 37
    versionCode = major * 1_000_000 + minor * 1_000 + patch
    versionName = release

    manifestPlaceholders["hostName"] = host
    manifestPlaceholders["launchUrl"] = launchUrl
    resValue("color", "background", backgroundColor)
    // Android string resources drop bare double quotes, hence the backslashes.
    resValue(
      "string",
      "asset_statements",
      """[{\"relation\": [\"delegate_permission/common.handle_all_urls\"], \"target\": {\"namespace\": \"web\", \"site\": \"https://$host\"}}]""",
    )
  }

  buildFeatures {
    resValues = true
  }

  signingConfigs {
    if (keystoreFile != null) {
      create("release") {
        storeFile = file(keystoreFile)
        storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
        keyAlias = System.getenv("ANDROID_KEY_ALIAS")
        keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.findByName("release")
    }
  }
}

dependencies {
  implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
