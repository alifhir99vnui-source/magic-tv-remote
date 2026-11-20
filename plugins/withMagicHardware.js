const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');

const withMagicHardware = (config) => {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    const perms = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.TRANSMIT_IR',
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ];
    for (const p of perms) {
      if (!manifest['uses-permission'].some((x) => x.$['android:name'] === p)) {
        manifest['uses-permission'].push({ $: { 'android:name': p } });
      }
    }
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    return cfg;
  });

  return config;
};

module.exports = withMagicHardware;
