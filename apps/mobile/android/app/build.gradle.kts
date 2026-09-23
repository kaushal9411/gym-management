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
        // `compileSdk`/`targetSdk` deliberately stay tied to whatever Flutter
        // SDK is installed (`flutter.compileSdkVersion`/`targetSdkVersion`,
        // above/below) rather than a hardcoded number — Flutter's own
        // tooling keeps these current with Play Store's evolving minimum
        // target API requirement, which changes yearly; a number pinned
        // here would silently go stale. `minSdk` is pinned explicitly since
        // it rarely needs to change and this project's one native-permission
        // dependency (`mobile_scanner`, the QR check-in scanner) documents
        // 21 as its own floor — confirmed against its android/build.gradle.
        minSdk = 21
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
