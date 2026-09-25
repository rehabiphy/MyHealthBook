/* postinstall: two native libraries MyHealth AI uses have no maintained
   release that builds on this project's Gradle 9 / AGP 8+:

   · @react-native-voice/voice@3.2.4 (speech-to-text)
   · react-native-tts@4.1.1 (text-to-speech, the spoken greeting)

   Both ship Android build.gradle files written for AGP 1–3 / jcenter
   (jcenter() is gone; AGP now requires `namespace` + `compileSdk`) and
   manifests that still set `package=`. Their Java code is fine, so only
   those files are replaced. Remove an entry if its package ever
   publishes a fixed version. */
const fs = require('fs');
const path = require('path');

const modules = path.join(__dirname, '..', 'node_modules');

const buildGradle = namespace => `apply plugin: 'com.android.library'

def safeExtGet(prop, fallback) {
    rootProject.ext.has(prop) ? rootProject.ext.get(prop) : fallback
}

android {
    namespace "${namespace}"
    compileSdk safeExtGet('compileSdkVersion', 35)

    defaultConfig {
        minSdk safeExtGet('minSdkVersion', 24)
        targetSdk safeExtGet('targetSdkVersion', 35)
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation 'com.facebook.react:react-android'
}
`;

function fixAndroid(pkg, namespace, manifest) {
  const android = path.join(modules, ...pkg.split('/'), 'android');
  if (!fs.existsSync(android)) return false;
  fs.writeFileSync(path.join(android, 'build.gradle'), buildGradle(namespace));
  fs.writeFileSync(path.join(android, 'src', 'main', 'AndroidManifest.xml'), manifest);
  return true;
}

const fixed = [];

if (
  fixAndroid(
    '@react-native-voice/voice',
    'com.wenkesj.voice',
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`,
  )
) {
  /* The Android module registers itself as "RCTVoice" (VoiceModule.getName)
     but the JS only looks up NativeModules.Voice (the iOS name), so on
     Android every call hits undefined and voice reports "unavailable". */
  const jsPath = path.join(modules, '@react-native-voice', 'voice', 'dist', 'index.js');
  const js = fs.readFileSync(jsPath, 'utf8');
  const fixedJs = js.replace(
    'const Voice = react_native_1.NativeModules.Voice;',
    'const Voice = react_native_1.NativeModules.Voice || react_native_1.NativeModules.RCTVoice;',
  );
  if (fixedJs !== js) fs.writeFileSync(jsPath, fixedJs);
  fixed.push('@react-native-voice/voice');
}

if (
  fixAndroid(
    'react-native-tts',
    'net.no_mad.tts',
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
</manifest>
`,
  )
) {
  fixed.push('react-native-tts');
}

if (fixed.length) console.log(`fix-native-libs: patched ${fixed.join(', ')} for AGP 8+`);
