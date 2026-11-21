const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const JAVA_SOURCE_PATH = path.join(
  __dirname,
  '..',
  'native',
  'MagicControlModule.java',
);
const PROGUARD_SOURCE_PATH = path.join(
  __dirname,
  '..',
  'native',
  'proguard-rules.pro',
);

function writeIfChanged(filePath, contents) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function setProperty(contents, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, `${key}=${value}`);
  return `${contents.trimEnd()}\n${key}=${value}\n`;
}

function patchBuildGradle(contents) {
  let patched = contents
    .replace(/versionCode\s+\d+/, 'versionCode 5')
    .replace(/versionName\s+"[^"]*"/, 'versionName "2.0.0"')
    .replace(/useLegacyPackaging enableLegacyPackaging\.toBoolean\(\)/, 'useLegacyPackaging true');

  if (!/ndk\s*\{[\s\S]*?abiFilters/.test(patched)) {
    patched = patched.replace(
      /defaultConfig\s*\{/,
      (match) => `${match}\n        ndk {\n            abiFilters "arm64-v8a", "armeabi-v7a"\n        }`,
    );
  }

  const debugBlock = 'debug {\n            signingConfig signingConfigs.debug\n        }';
  if (patched.includes(debugBlock)) {
    patched = patched.replace(
      debugBlock,
      'debug {\n            signingConfig signingConfigs.debug\n            minifyEnabled true\n            shrinkResources true\n            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"\n        }',
    );
  }

  return patched;
}

function patchGradleProperties(contents) {
  let patched = contents;
  patched = setProperty(patched, 'android.enableMinifyInReleaseBuilds', 'true');
  patched = setProperty(patched, 'android.enablePngCrunchInReleaseBuilds', 'true');
  patched = setProperty(patched, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
  patched = setProperty(patched, 'reactNativeArchitectures', 'armeabi-v7a,arm64-v8a');
  patched = setProperty(patched, 'expo.useLegacyPackaging', 'true');
  patched = setProperty(patched, 'expo.gif.enabled', 'false');
  patched = setProperty(patched, 'expo.webp.enabled', 'false');
  patched = setProperty(patched, 'expo.webp.animated', 'false');
  patched = setProperty(patched, 'EX_DEV_CLIENT_NETWORK_INSPECTOR', 'false');
  patched = setProperty(patched, 'newArchEnabled', 'false');
  return patched;
}

function writeNativeModule(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java/com/magicremote/tvremote',
      );
      const destination = path.join(javaDir, 'MagicControlModule.java');
      if (!fs.existsSync(JAVA_SOURCE_PATH)) {
        throw new Error(`Missing native source: ${JAVA_SOURCE_PATH}`);
      }
      fs.mkdirSync(javaDir, { recursive: true });
      if (path.resolve(JAVA_SOURCE_PATH) !== path.resolve(destination)) {
        fs.copyFileSync(JAVA_SOURCE_PATH, destination);
      }
      return cfg;
    },
  ]);
}

function withBuildOptimizations(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const gradlePath = path.join(root, 'app/build.gradle');
      const propertiesPath = path.join(root, 'gradle.properties');
      const proguardPath = path.join(root, 'app/proguard-rules.pro');

      if (!fs.existsSync(PROGUARD_SOURCE_PATH)) {
        throw new Error(`Missing ProGuard rules: ${PROGUARD_SOURCE_PATH}`);
      }
      writeIfChanged(proguardPath, fs.readFileSync(PROGUARD_SOURCE_PATH, 'utf8'));
      if (fs.existsSync(gradlePath)) {
        writeIfChanged(gradlePath, patchBuildGradle(fs.readFileSync(gradlePath, 'utf8')));
      }
      if (fs.existsSync(propertiesPath)) {
        writeIfChanged(
          propertiesPath,
          patchGradleProperties(fs.readFileSync(propertiesPath, 'utf8')),
        );
      }
      return cfg;
    },
  ]);
}

function registerPackage(config) {
  return withMainApplication(config, (cfg) => {
    if (
      cfg.modResults.contents.includes('MagicControlModule.MagicControlPackage()')
    ) {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /PackageList\(this\)\.packages\.apply \{/,
      'PackageList(this).packages.apply {\n           add(MagicControlModule.MagicControlPackage())',
    );
    return cfg;
  });
}

const withNativeRemote = (config) =>
  registerPackage(withBuildOptimizations(writeNativeModule(config)));

module.exports = withNativeRemote;
