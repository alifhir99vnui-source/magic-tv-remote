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
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_MULTICAST_STATE',
      'android.permission.WAKE_LOCK',
    ];
    for (const p of perms) {
      if (!manifest['uses-permission'].some((x) => x.$['android:name'] === p)) {
        manifest['uses-permission'].push({ $: { 'android:name': p } });
      }
    }

    if (Array.isArray(manifest.queries)) {
      manifest.queries = manifest.queries.filter((query) => {
        const actions = query.intent?.actions?.action ?? [];
        return !actions.some(
          (action) => action?.$?.['android:name'] === 'android.speech.action.RECOGNIZE_SPEECH',
        );
      });
      if (manifest.queries.length === 0) delete manifest.queries;
    }

    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    return cfg;
  });

  return config;
};

module.exports = withMagicHardware;
