-keep class com.magicremote.tvremote.** { *; }
-keep class com.magicremote.tvremote.MagicControlModule$* { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class expo.modules.** { *; }
-keep class org.unimodules.** { *; }
-keep class com.androidtvremote.** { *; }
-keepclassmembers class * {
  @com.facebook.react.bridge.ReactMethod <methods>;
}
-keepclassmembers class * implements com.facebook.react.bridge.NativeModule {
  public <init>(com.facebook.react.bridge.ReactApplicationContext);
}
-dontwarn com.facebook.react.**
-dontwarn expo.modules.**
-dontwarn org.unimodules.**
