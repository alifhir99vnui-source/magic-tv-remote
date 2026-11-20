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

    manifest.queries = manifest.queries || [];
    const voiceQuery = {
      intent: [{ action: { $: { 'android:name': 'android.speech.action.RECOGNIZE_SPEECH' } } }],
    };
    const hasVoiceQuery = manifest.queries.some(
      (q) => q.intent && q.intent.some(
        (i) => i.action && i.action.$ && i.action.$['android:name'] === 'android.speech.action.RECOGNIZE_SPEECH',
      ),
    );
    if (!hasVoiceQuery) manifest.queries.push(voiceQuery);
    return cfg;
  });

  config = withMainActivity(config, (cfg) => {
    return cfg;
  });

  return config;
};

module.exports = withMagicHardware;
