const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const JAVA_SOURCE = `package com.magicremote.tvremote;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.ConsumerIrManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.ReactPackage;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@ReactModule(name = "MagicControl")
public class MagicControlModule extends ReactContextBaseJavaModule {
  private static final String TAG = "MagicControl";
  private static final byte[] HID_DESCRIPTOR = new byte[] {
    (byte) 0x05, (byte) 0x01, (byte) 0x09, (byte) 0x80, (byte) 0xA1, (byte) 0x01, (byte) 0x85, (byte) 0x01,
    (byte) 0x05, (byte) 0x07, (byte) 0x19, (byte) 0xE0, (byte) 0x29, (byte) 0xE7, (byte) 0x15, (byte) 0x00,
    (byte) 0x25, (byte) 0x01, (byte) 0x75, (byte) 0x01, (byte) 0x95, (byte) 0x08, (byte) 0x81, (byte) 0x02,
    (byte) 0x95, (byte) 0x01, (byte) 0x75, (byte) 0x08, (byte) 0x81, (byte) 0x01, (byte) 0x95, (byte) 0x05,
    (byte) 0x75, (byte) 0x01, (byte) 0x05, (byte) 0x07, (byte) 0x19, (byte) 0x00, (byte) 0x29, (byte) 0x65,
    (byte) 0x15, (byte) 0x00, (byte) 0x25, (byte) 0x65, (byte) 0x81, (byte) 0x00, (byte) 0xC0,
    (byte) 0x05, (byte) 0x01, (byte) 0x09, (byte) 0x02, (byte) 0xA1, (byte) 0x01, (byte) 0x85, (byte) 0x02,
    (byte) 0x09, (byte) 0x01, (byte) 0xA1, (byte) 0x00, (byte) 0x05, (byte) 0x09, (byte) 0x19, (byte) 0x01,
    (byte) 0x29, (byte) 0x03, (byte) 0x15, (byte) 0x00, (byte) 0x25, (byte) 0x01, (byte) 0x95, (byte) 0x03,
    (byte) 0x75, (byte) 0x01, (byte) 0x81, (byte) 0x02, (byte) 0x95, (byte) 0x01, (byte) 0x75, (byte) 0x05,
    (byte) 0x81, (byte) 0x01, (byte) 0x05, (byte) 0x01, (byte) 0x09, (byte) 0x30, (byte) 0x09, (byte) 0x31,
    (byte) 0x15, (byte) 0x81, (byte) 0x25, (byte) 0x7F, (byte) 0x75, (byte) 0x08, (byte) 0x95, (byte) 0x02,
    (byte) 0x81, (byte) 0x06,     (byte) 0x05, (byte) 0x01, (byte) 0x09, (byte) 0x38, (byte) 0x15, (byte) 0x81,
    (byte) 0x25, (byte) 0x7F, (byte) 0x75, (byte) 0x08, (byte) 0x95, (byte) 0x01, (byte) 0x81, (byte) 0x06,
    (byte) 0xC0, (byte) 0xC0,
    (byte) 0x05, (byte) 0x0C, (byte) 0x09, (byte) 0x01, (byte) 0xA1, (byte) 0x01, (byte) 0x85, (byte) 0x03,
    (byte) 0x15, (byte) 0x00, (byte) 0x26, (byte) 0xFF, (byte) 0x00, (byte) 0x75, (byte) 0x10,
    (byte) 0x95, (byte) 0x01, (byte) 0x09, (byte) 0x00, (byte) 0x81, (byte) 0x00, (byte) 0xC0
  };

  private static final Map<String, Integer> IR_KEYS = new HashMap<String, Integer>();
  private static final Map<String, Integer> HID_KEYS = new HashMap<String, Integer>();

  static {
    IR_KEYS.put("power", 0x14);
    IR_KEYS.put("mute", 0x0D);
    IR_KEYS.put("info", 0x1C);
    IR_KEYS.put("menu", 0x4D);
    IR_KEYS.put("settings", 0x4D);
    IR_KEYS.put("up", 0x16);
    IR_KEYS.put("down", 0x1A);
    IR_KEYS.put("left", 0x51);
    IR_KEYS.put("right", 0x50);
    IR_KEYS.put("ok", 0x13);
    IR_KEYS.put("back", 0x19);
    IR_KEYS.put("home", 0x11);
    IR_KEYS.put("volumeUp", 0x18);
    IR_KEYS.put("volumeDown", 0x10);
    IR_KEYS.put("channelUp", 0x1B);
    IR_KEYS.put("channelDown", 0x1E);
    IR_KEYS.put("voice", 0x42);
    IR_KEYS.put("num0", 0x00);
    IR_KEYS.put("num1", 0x01);
    IR_KEYS.put("num2", 0x02);
    IR_KEYS.put("num3", 0x03);
    IR_KEYS.put("num4", 0x04);
    IR_KEYS.put("num5", 0x05);
    IR_KEYS.put("num6", 0x06);
    IR_KEYS.put("num7", 0x07);
    IR_KEYS.put("num8", 0x08);
    IR_KEYS.put("num9", 0x09);

    HID_KEYS.put("up", 0x52);
    HID_KEYS.put("down", 0x51);
    HID_KEYS.put("left", 0x50);
    HID_KEYS.put("right", 0x4F);
    HID_KEYS.put("ok", 0x28);
    HID_KEYS.put("select", 0x28);
    HID_KEYS.put("enter", 0x28);
    HID_KEYS.put("back", 0x29);
    HID_KEYS.put("del", 0x2A);
    HID_KEYS.put("home", 0x2A);
    HID_KEYS.put("menu", 0x2F);
    HID_KEYS.put("settings", 0x2F);
    HID_KEYS.put("volumeUp", 0xE9);
    HID_KEYS.put("volumeDown", 0xEA);
    HID_KEYS.put("mute", 0xE2);
    HID_KEYS.put("channelUp", 0x9B);
    HID_KEYS.put("channelDown", 0x9A);
    HID_KEYS.put("playPause", 0xCD);
    HID_KEYS.put("play", 0xB0);
    HID_KEYS.put("pause", 0xB1);
    HID_KEYS.put("stop", 0xB7);
    HID_KEYS.put("next", 0xB5);
    HID_KEYS.put("prev", 0xB6);
    HID_KEYS.put("voice", 0xCA);
    HID_KEYS.put("search", 0xCB);
    HID_KEYS.put("info", 0x40);
    HID_KEYS.put("red", 0x28);
    HID_KEYS.put("green", 0x28);
    HID_KEYS.put("yellow", 0x28);
    HID_KEYS.put("blue", 0x28);
    for (int i = 0; i <= 9; i++) {
      HID_KEYS.put("num" + i, 0x1E + i);
    }
  }

  private final ExecutorService executor = Executors.newCachedThreadPool();
  private BluetoothHidDevice hidDevice;
  private BluetoothDevice connectedHidDevice;
  private boolean hidRegistered;
  private boolean hidRegistering;
  private final BluetoothProfile.ServiceListener hidProfileListener = new BluetoothProfile.ServiceListener() {
    @Override
    public void onServiceConnected(int profile, BluetoothProfile proxy) {
      if (profile == BluetoothProfile.HID_DEVICE && proxy instanceof BluetoothHidDevice) {
        hidDevice = (BluetoothHidDevice) proxy;
        registerHidApp();
      }
    }

    @Override
    public void onServiceDisconnected(int profile) {
      if (profile == BluetoothProfile.HID_DEVICE) {
        hidDevice = null;
        hidRegistered = false;
        connectedHidDevice = null;
      }
    }
  };

  private final BluetoothHidDevice.Callback hidCallback = new BluetoothHidDevice.Callback() {
    @Override
    public void onAppStatusChanged(BluetoothDevice pluggedDevice, boolean registered) {
      hidRegistered = registered;
      if (!registered) connectedHidDevice = null;
    }

    @Override
    public void onConnectionStateChanged(BluetoothDevice device, int state) {
      if (state == BluetoothProfile.STATE_CONNECTED) {
        connectedHidDevice = device;
      } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
        if (connectedHidDevice != null && connectedHidDevice.equals(device)) {
          connectedHidDevice = null;
        }
      }
    }
  };

  public MagicControlModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "MagicControl";
  }

  @Override
  public Map<String, Object> getConstants() {
    Map<String, Object> constants = new HashMap<>();
    constants.put("moduleName", "MagicControl");
    return constants;
  }

  private boolean hasPermission(String permission) {
    return getReactApplicationContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
  }

  private ConsumerIrManager irManager() {
    return (ConsumerIrManager) getReactApplicationContext().getSystemService(Context.CONSUMER_IR_SERVICE);
  }

  @ReactMethod
  public void hasIrEmitter(Promise promise) {
    ConsumerIrManager manager = irManager();
    promise.resolve(manager != null && manager.hasIrEmitter());
  }

  @ReactMethod
  public void transmitIr(int carrierFrequency, ReadableArray pattern, Promise promise) {
    try {
      ConsumerIrManager manager = irManager();
      if (manager == null || !manager.hasIrEmitter()) {
        promise.resolve(false);
        return;
      }
      int[] timings = new int[pattern.size()];
      for (int i = 0; i < pattern.size(); i++) {
        timings[i] = pattern.getInt(i);
      }
      manager.transmit(carrierFrequency, timings);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void sendIrKey(String key, Promise promise) {
    Integer code = IR_KEYS.get(key == null ? "" : key);
    if (code == null) {
      promise.resolve(false);
      return;
    }
    int cmd = code & 0xFF;
    int inv = (~cmd) & 0xFF;
    int[] pattern = buildNecPattern(0x01, 0xFE, cmd, inv);
    try {
      ConsumerIrManager manager = irManager();
      if (manager == null || !manager.hasIrEmitter()) {
        promise.resolve(false);
        return;
      }
      manager.transmit(38000, pattern);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.resolve(false);
    }
  }

  private int[] buildNecPattern(int lowAddress, int highAddress, int command, int inverse) {
    int[] pattern = new int[69];
    pattern[0] = 9000;
    pattern[1] = 4500;
    int index = 2;
    int[] bytes = new int[] { lowAddress, highAddress, command, inverse };
    for (int value : bytes) {
      for (int bit = 0; bit < 8; bit++) {
        pattern[index++] = 562;
        pattern[index++] = ((value >> bit) & 1) == 1 ? 1687 : 562;
      }
    }
    pattern[index] = 562;
    return pattern;
  }

  @ReactMethod
  public void launchTvApp(String packageName, Promise promise) {
    try {
      Context context = getReactApplicationContext();
      PackageManager manager = context.getPackageManager();
      Intent launchIntent = manager.getLaunchIntentForPackage(packageName);
      if (launchIntent == null) {
        promise.resolve(false);
        return;
      }
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      context.startActivity(launchIntent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void isPointerSupported(Promise promise) {
    promise.resolve(true);
  }

  @ReactMethod
  public void isAirMouseSupported(Promise promise) {
    promise.resolve(false);
  }

  @ReactMethod
  public void recenterPointer(Promise promise) {
    promise.resolve(true);
  }

  @ReactMethod
  public void scanBluetoothDevices(Promise promise) {
    executor.execute(() -> {
      WritableArray results = new WritableNativeArray();
      BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
      if (adapter == null) {
        promise.resolve(results);
        return;
      }
      addBondedDevices(adapter, results);

      if (!adapter.isDiscovering()) {
        try {
          if (Build.VERSION.SDK_INT >= 31 && !hasPermission(Manifest.permission.BLUETOOTH_SCAN)) {
            promise.resolve(results);
            return;
          }
          adapter.startDiscovery();
        } catch (Throwable error) {
          promise.resolve(results);
          return;
        }
      }

      BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
          if (!BluetoothDevice.ACTION_FOUND.equals(intent.getAction())) return;
          BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
          if (device == null) return;
          String name = safeName(device);
          String address = safeAddress(device);
          if (name == null || address == null) return;
          for (int i = 0; i < results.size(); i++) {
            WritableMap existing = results.getMap(i);
            if (address.equals(existing.getString("address"))) return;
          }
          WritableMap item = new WritableNativeMap();
          item.putString("name", name);
          item.putString("address", address);
          item.putInt("bondState", device.getBondState());
          results.pushMap(item);
        }
      };

      try {
        getReactApplicationContext().registerReceiver(receiver, new IntentFilter(BluetoothDevice.ACTION_FOUND));
      } catch (Throwable error) {
        promise.resolve(results);
        return;
      }

      try {
        Thread.sleep(6000);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
      }
      try {
        getReactApplicationContext().unregisterReceiver(receiver);
      } catch (Throwable ignored) {
      }
      try {
        adapter.cancelDiscovery();
      } catch (Throwable ignored) {
      }
      promise.resolve(results);
    });
  }

  private void addBondedDevices(BluetoothAdapter adapter, WritableArray results) {
    try {
      if (Build.VERSION.SDK_INT >= 31 && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) return;
      for (BluetoothDevice device : adapter.getBondedDevices()) {
        String name = safeName(device);
        String address = safeAddress(device);
        if (name == null || address == null) continue;
        WritableMap item = new WritableNativeMap();
        item.putString("name", name);
        item.putString("address", address);
        item.putInt("bondState", device.getBondState());
        results.pushMap(item);
      }
    } catch (Throwable error) {
      Log.w(TAG, "bonded device scan failed", error);
    }
  }

  private String safeName(BluetoothDevice device) {
    try {
      String name = device.getName();
      return name == null || name.trim().isEmpty() ? "MAGIC_A200" : name.trim();
    } catch (Throwable error) {
      return "MAGIC_A200";
    }
  }

  private String safeAddress(BluetoothDevice device) {
    try {
      return device.getAddress();
    } catch (Throwable error) {
      return null;
    }
  }

  @ReactMethod
  public void pairOrConnectBluetoothHid(String address, Promise promise) {
    executor.execute(() -> {
      BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
      if (adapter == null || address == null) {
        promise.resolve(false);
        return;
      }
      if (Build.VERSION.SDK_INT >= 31 && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
        promise.resolve(false);
        return;
      }

      BluetoothDevice device;
      try {
        device = adapter.getRemoteDevice(address);
      } catch (Throwable error) {
        promise.resolve(false);
        return;
      }

      if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
        BroadcastReceiver bondReceiver = new BroadcastReceiver() {
          @Override
          public void onReceive(Context context, Intent intent) {
            BluetoothDevice bonded = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
            if (bonded == null || !address.equals(safeAddress(bonded))) return;
            int state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.BOND_NONE);
            if (state == BluetoothDevice.BOND_BONDED) {
              try {
                getReactApplicationContext().unregisterReceiver(this);
              } catch (Throwable ignored) {
              }
              connectHidDevice(device, promise);
            } else if (state == BluetoothDevice.BOND_NONE) {
              try {
                getReactApplicationContext().unregisterReceiver(this);
              } catch (Throwable ignored) {
              }
              promise.resolve(false);
            }
          }
        };
        try {
          getReactApplicationContext().registerReceiver(
            bondReceiver,
            new IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
          );
          if (!device.createBond()) {
            try {
              getReactApplicationContext().unregisterReceiver(bondReceiver);
            } catch (Throwable ignored) {
            }
            promise.resolve(false);
            return;
          }
        } catch (Throwable error) {
          try {
            getReactApplicationContext().unregisterReceiver(bondReceiver);
          } catch (Throwable ignored) {
          }
          promise.resolve(false);
        }
        return;
      }

      connectHidDevice(device, promise);
    });
  }

  private void ensureHidProxy() {
    if (hidDevice != null) return;
    try {
      BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
      if (adapter == null) return;
      if (Build.VERSION.SDK_INT >= 31 && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) return;
      adapter.getProfileProxy(getReactApplicationContext(), hidProfileListener, BluetoothProfile.HID_DEVICE);
    } catch (Throwable error) {
      Log.w(TAG, "HID proxy failed", error);
    }
  }

  private void registerHidApp() {
    if (hidDevice == null || hidRegistered || hidRegistering) return;
    hidRegistering = true;
    try {
      UUID uuid = UUID.randomUUID();
      BluetoothHidDeviceAppSdpSettings sdp = new BluetoothHidDeviceAppSdpSettings(
        "Magic TV Remote",
        "Magic TV Remote HID",
        "MagicRemote",
        BluetoothHidDevice.SUBCLASS1_COMBO,
        HID_DESCRIPTOR
      );
      hidDevice.registerApp(sdp, null, null, executor, hidCallback);
    } catch (Throwable error) {
      Log.w(TAG, "HID register failed", error);
      hidRegistering = false;
    }
  }

  private void connectHidDevice(BluetoothDevice device, Promise promise) {
    ensureHidProxy();
    final long deadline = System.currentTimeMillis() + 12000;
    while (System.currentTimeMillis() < deadline && !hidRegistered) {
      registerHidApp();
      try {
        Thread.sleep(150);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
        break;
      }
    }
    if (hidDevice == null || !hidRegistered) {
      promise.resolve(false);
      return;
    }
    try {
      boolean connected = hidDevice.connect(device);
      promise.resolve(connected);
    } catch (Throwable error) {
      promise.resolve(false);
    }
  }

  private boolean sendKeyboardReport(int modifier, int keyCode) {
    if (hidDevice == null || connectedHidDevice == null) return false;
    byte[] report = new byte[8];
    report[0] = (byte) modifier;
    report[2] = (byte) keyCode;
    try {
      return hidDevice.sendReport(connectedHidDevice, (byte) 1, report);
    } catch (Throwable error) {
      return false;
    }
  }

  private boolean sendConsumerReport(int usage) {
    if (hidDevice == null || connectedHidDevice == null) return false;
    byte[] report = new byte[2];
    report[0] = (byte) (usage & 0xFF);
    report[1] = (byte) ((usage >> 8) & 0xFF);
    try {
      return hidDevice.sendReport(connectedHidDevice, (byte) 3, report);
    } catch (Throwable error) {
      return false;
    }
  }

  private boolean sendMouseReport(int buttons, int dx, int dy, int wheel) {
    if (hidDevice == null || connectedHidDevice == null) return false;
    byte[] report = new byte[5];
    report[0] = (byte) buttons;
    report[1] = (byte) Math.max(-127, Math.min(127, dx));
    report[2] = (byte) Math.max(-127, Math.min(127, dy));
    report[3] = (byte) Math.max(-127, Math.min(127, wheel));
    try {
      return hidDevice.sendReport(connectedHidDevice, (byte) 2, report);
    } catch (Throwable error) {
      return false;
    }
  }

  @ReactMethod
  public void sendBluetoothHidKey(String key, Promise promise) {
    Integer keyCode = HID_KEYS.get(key == null ? "" : key);
    if (keyCode == null) {
      promise.resolve(false);
      return;
    }
    executor.execute(() -> {
      ensureHidProxy();
      boolean consumer = keyCode >= 0x80;
      boolean pressed = consumer
        ? sendConsumerReport(keyCode)
        : sendKeyboardReport(0, keyCode);
      try {
        Thread.sleep(45);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
      }
      boolean released = consumer
        ? sendConsumerReport(0)
        : sendKeyboardReport(0, 0);
      promise.resolve(pressed && released);
    });
  }

  @ReactMethod
  public void sendMouseMove(double dx, double dy, Promise promise) {
    executor.execute(() -> {
      boolean sent = sendMouseReport(0, (int) Math.round(dx), (int) Math.round(dy), 0);
      promise.resolve(sent);
    });
  }

  @ReactMethod
  public void sendMouseClick(String button, Promise promise) {
    executor.execute(() -> {
      int bit = "right".equalsIgnoreCase(button == null ? "" : button) ? 2 : 1;
      boolean down = sendMouseReport(bit, 0, 0, 0);
      try {
        Thread.sleep(45);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
      }
      boolean up = sendMouseReport(0, 0, 0, 0);
      promise.resolve(down && up);
    });
  }

  @ReactMethod
  public void sendMouseScroll(double deltaY, Promise promise) {
    executor.execute(() -> {
      int wheel = (int) Math.round(deltaY / 12.0);
      boolean sent = sendMouseReport(0, 0, 0, wheel);
      promise.resolve(sent);
    });
  }

  public static class MagicControlPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
      List<NativeModule> modules = new ArrayList<>();
      modules.add(new MagicControlModule(reactContext));
      return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
      return Collections.emptyList();
    }
  }
}
`;

function writeNativeModule(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/java/com/magicremote/tvremote',
      );
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(path.join(javaDir, 'MagicControlModule.java'), JAVA_SOURCE);
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
