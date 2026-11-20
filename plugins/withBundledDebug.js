const { withAppBuildGradle } = require('@expo/config-plugins');

const withBundledDebug = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('debuggableVariants = []')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /(^[\t ]*autolinkLibrariesWithApp\(\)$)/m,
        '    debuggableVariants = []\n$1',
      );
    }
    return cfg;
  });

module.exports = withBundledDebug;
