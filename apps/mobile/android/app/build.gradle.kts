import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing — read from android/key.properties, which is gitignored
// (see android/.gitignore). That file does not exist in this repo; it must
// be created locally by whoever cuts a release, from a keystore generated
// with `keytool` (see docs/MOBILE-GUIDE.md for the exact command). Until
// then, `signingConfigs.release` below resolves to nulls and a real
// `flutter build ... --release` fails loudly with a clear signing error —
// `flutter run --release` for local dev is unaffected either way.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.fitcloud.gym_saas_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.fitcloud.gym_saas_mobile"
        // `compileSdk`/`targetSdk`/`minSdk` all deliberately stay tied to
        // whatever Flutter SDK is installed rather than hardcoded numbers —
        // Flutter's own build tooling silently rewrites a pinned `minSdk`
        // back to `flutter.minSdkVersion` on every release build (confirmed:
        // it clobbered an explicit `minSdk = 21` pin twice in a row), so
        // fighting it isn't sustainable. Current Flutter (3.47.5) defaults
        // this to 24 — still well above mobile_scanner's own documented
        // floor of 21, so no functionality is lost, just ~1-2% of very old
        // devices (Android 5.0-6.0) that were never a real target anyway.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String?
                keyPassword = keystoreProperties["keyPassword"] as String?
                storeFile = keystoreProperties["storeFile"]?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String?
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

flutter {
    source = "../.."
}
