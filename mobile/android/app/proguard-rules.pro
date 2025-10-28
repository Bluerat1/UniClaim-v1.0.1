# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# Keep network security config
-keep class android.net.http.** { *; }
-keep class android.security.net.config.** { *; }
-keep class android.security.NetworkSecurityPolicy { *; }
-keep class com.android.org.conscrypt.** { *; }

# Keep Cloudinary classes
-keep class com.cloudinary.** { *; }
-keep class com.cloudinary.android.** { *; }

# Keep all classes that might be accessed through reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses

# Keep all native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep all public classes and methods
-keep public class * {
    public *;
}

# Keep all classes that implement Parcelable
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep all Serializable classes
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
