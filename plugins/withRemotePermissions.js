const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');
module.exports = config => withAppBuildGradle(withAndroidManifest(config, config => {
  const m = config.modResults.manifest;
  const permissions = ['android.permission.BLUETOOTH','android.permission.BLUETOOTH_ADMIN','android.permission.BLUETOOTH_SCAN','android.permission.BLUETOOTH_CONNECT','android.permission.BLUETOOTH_ADVERTISE','android.permission.ACCESS_FINE_LOCATION','android.permission.INTERNET'];
  m['uses-permission'] = m['uses-permission'] || [];
  permissions.forEach(name => { if (!m['uses-permission'].some(p => p.$['android:name'] === name)) m['uses-permission'].push({$: {'android:name':name}}); });
  m['uses-feature'] = m['uses-feature'] || [];
  m['uses-feature'].push({$: {'android:name':'android.hardware.bluetooth','android:required':'false'}});
  return config;
}), config => {
  const gradle = config.modResults.contents;
  if (!gradle.includes('com.tananaev:adblib:1.3')) {
    config.modResults.contents = gradle.replace(/dependencies \{/, "dependencies {\n    implementation 'com.tananaev:adblib:1.3'");
  }
  return config;
});
