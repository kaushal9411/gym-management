# Flutter's Dart code is AOT-compiled to native code and is never touched by
# R8/ProGuard — these rules only protect the Kotlin/Java plugin-embedding
# layer. Most Flutter plugins (including this app's mobile_scanner, dio,
# image_picker, etc.) ship their own consumer-rules.pro bundled in their AAR,
# which R8 picks up automatically without needing to duplicate anything here.
# This is the standard defensive baseline for the Flutter embedding itself.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Play Core split-install classes referenced by Flutter's deferred-components
# support even when a project (like this one) doesn't use deferred
# components — without this, a default Flutter release build can warn/fail
# on "missing classes" from com.google.android.play.core.*.
-dontwarn com.google.android.play.core.**
