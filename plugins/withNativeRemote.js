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

const withNativeRemote = (config) => registerPackage(writeNativeModule(config));

module.exports = withNativeRemote;
