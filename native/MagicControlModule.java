package com.magicremote.tvremote;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothProfile;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.hardware.ConsumerIrManager;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.ReactPackage;
import com.facebook.react.uimanager.ViewManager;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@ReactModule(name = "MagicControl")
public class MagicControlModule extends ReactContextBaseJavaModule {
  private static final String TAG = "MagicControl";
  private static final String SSDP_REQUEST =
      "M-SEARCH * HTTP/1.1\r\n" +
      "HOST: 239.255.255.250:1900\r\n" +
      "MAN: \"ssdp:discover\"\r\n" +
      "MX: 2\r\n" +
      "ST: ssdp:all\r\n" +
      "\r\n";
  private static final String[] NSD_TYPES = new String[] {
      "_androidtvremote2._tcp.",
      "_androidtvremote._tcp.",
      "_googlecast._tcp.",
      "_airplay._tcp."
  };

  private final AtomicInteger mouseButtons = new AtomicInteger(0);
  private PowerManager.WakeLock wakeLock;
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
    (byte) 0x15, (byte) 0x00, (byte) 0x26, (byte) 0xFF, (byte) 0xFF, (byte) 0x75, (byte) 0x10,
    (byte) 0x95, (byte) 0x01, (byte) 0x09, (byte) 0x00, (byte) 0x81, (byte) 0x00, (byte) 0xC0
  };

  private static final Map<String, Integer> IR_KEYS = new HashMap<String, Integer>();
  private static final Map<String, Integer> HID_KEYS = new HashMap<String, Integer>();

  private static class DiscoveredDevice {
    final String name;
    final String ip;
    final int port;
    final String source;

    DiscoveredDevice(String name, String ip, int port, String source) {
      this.name = name;
      this.ip = ip;
      this.port = port;
      this.source = source;
    }
  }

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
    IR_KEYS.put("source", 0x54);
    IR_KEYS.put("recents", 0x6D);
    IR_KEYS.put("playPause", 0x35);
    IR_KEYS.put("rewind", 0x36);
    IR_KEYS.put("forward", 0x37);
    IR_KEYS.put("stop", 0x38);
    IR_KEYS.put("subtitle", 0x39);
    IR_KEYS.put("audio", 0x3A);
    IR_KEYS.put("red", 0x26);
    IR_KEYS.put("green", 0x27);
    IR_KEYS.put("yellow", 0x28);
    IR_KEYS.put("blue", 0x29);

    HID_KEYS.put("up", 0x52);
    HID_KEYS.put("down", 0x51);
    HID_KEYS.put("left", 0x50);
    HID_KEYS.put("right", 0x4F);
    HID_KEYS.put("ok", 0x28);
    HID_KEYS.put("select", 0x28);
    HID_KEYS.put("enter", 0x28);
    HID_KEYS.put("back", 0x29);
    HID_KEYS.put("del", 0x2A);
    HID_KEYS.put("home", 0x47);
    HID_KEYS.put("menu", 0x2F);
    HID_KEYS.put("settings", 0x2F);
    HID_KEYS.put("pageUp", 0x4B);
    HID_KEYS.put("pageDown", 0x4E);
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
    HID_KEYS.put("source", 0xE6);
    HID_KEYS.put("recents", 0x2F);
    HID_KEYS.put("rewind", 0xB3);
    HID_KEYS.put("forward", 0xB4);
    HID_KEYS.put("subtitle", 0xCD);
    HID_KEYS.put("audio", 0x188);
    HID_KEYS.put("red", 0x3A);
    HID_KEYS.put("green", 0x3B);
    HID_KEYS.put("yellow", 0x3C);
    HID_KEYS.put("blue", 0x3D);
    for (int i = 0; i <= 9; i++) {
      HID_KEYS.put("num" + i, 0x1E + i);
    }
  }

  private final ExecutorService executor = Executors.newCachedThreadPool();

  private static boolean isConsumerUsage(int keyCode) {
    switch (keyCode) {
      case 0xE9:
      case 0xEA:
      case 0xE2:
      case 0x9B:
      case 0x9A:
      case 0xCD:
      case 0xB0:
      case 0xB1:
      case 0xB7:
      case 0xB5:
      case 0xB6:
      case 0xCA:
      case 0xCB:
      case 0xE6:
      case 0xB3:
      case 0xB4:
      case 0x188:
        return true;
      default:
        return false;
    }
  }
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
    executor.execute(() -> {
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
    });
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
    executor.execute(() -> {
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
    });
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
  public void setKeepAwake(boolean enabled, Promise promise) {
    try {
      PowerManager manager = (PowerManager) getReactApplicationContext()
          .getSystemService(Context.POWER_SERVICE);
      if (manager == null) {
        promise.resolve(false);
        return;
      }
      if (enabled) {
        if (wakeLock == null) {
          wakeLock = manager.newWakeLock(
              PowerManager.SCREEN_DIM_WAKE_LOCK | PowerManager.ON_AFTER_RELEASE,
              "MagicRemote:KeepAwake");
          wakeLock.setReferenceCounted(false);
        }
        if (!wakeLock.isHeld()) wakeLock.acquire();
      } else if (wakeLock != null && wakeLock.isHeld()) {
        wakeLock.release();
      }
      promise.resolve(true);
    } catch (Throwable error) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void getClipboardText(Promise promise) {
    try {
      ClipboardManager clipboard = (ClipboardManager) getReactApplicationContext()
          .getSystemService(Context.CLIPBOARD_SERVICE);
      if (clipboard == null || !clipboard.hasPrimaryClip()) {
        promise.resolve("");
        return;
      }
      ClipData.Item item = clipboard.getPrimaryClip().getItemAt(0);
      CharSequence text = item == null ? null : item.getText();
      promise.resolve(text == null ? "" : text.toString());
    } catch (Throwable error) {
      promise.resolve("");
    }
  }

  @ReactMethod
  public void getInstalledApps(Promise promise) {
    executor.execute(() -> promise.resolve(readInstalledPackages(null, 0)));
  }

  @ReactMethod
  public void getInstalledTvAppsFromHost(String ip, int port, Promise promise) {
    executor.execute(() -> {
      WritableArray fromHttp = readInstalledPackages(ip, port > 0 ? port : 5555);
      if (fromHttp.size() > 0) {
        promise.resolve(fromHttp);
        return;
      }
      promise.resolve(readInstalledPackagesFromAdbShell(ip));
    });
  }

  @ReactMethod
  public void runTvShellCommand(String ip, int port, String command, Promise promise) {
    executor.execute(() -> {
      boolean ok = runShellCommandOnHost(ip, port > 0 ? port : 5555, command);
      promise.resolve(ok);
    });
  }

  private boolean runShellCommandOnHost(String ip, int port, String command) {
    if (command == null || command.trim().isEmpty()) return false;
    if (command.contains("\n") || command.contains("\r")) return false;
    String host = ip == null ? "" : ip.trim();
    if (host.isEmpty() || host.equals("0.0.0.0")) return false;
    try {
      String encoded = URLEncoder.encode(command, StandardCharsets.UTF_8.name());
      URL url = new URL("http://" + host + ":" + port + "/api/shell?command=" + encoded);
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      connection.setConnectTimeout(1500);
      connection.setReadTimeout(2500);
      connection.setRequestMethod("GET");
      int status = connection.getResponseCode();
      connection.disconnect();
      if (status >= 200 && status < 300) return true;
    } catch (Throwable ignored) {
    }
    Socket socket = null;
    try {
      socket = new Socket();
      socket.connect(new InetSocketAddress(host, 5555), 2000);
      socket.setSoTimeout(2500);
      OutputStream output = socket.getOutputStream();
      output.write(("shell:" + command + "\n").getBytes(StandardCharsets.UTF_8));
      output.flush();
      return true;
    } catch (Throwable error) {
      Log.w(TAG, "TV shell command failed", error);
      return false;
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (Throwable ignored) {
        }
      }
    }
  }

  @ReactMethod
  public void getTvDeviceIdentity(String ip, int port, Promise promise) {
    executor.execute(() -> {
      String host = ip == null ? "" : ip.trim();
      WritableMap result = new WritableNativeMap();
      result.putString("name", "");
      result.putString("model", "");
      if (host.isEmpty() || host.equals("0.0.0.0")) {
        promise.resolve(result);
        return;
      }
      String friendly = readIdentityFromHttp(host, port > 0 ? port : 5555);
      String model = matchDeviceValue(friendly, "modelNumber");
      if (model == null || model.isEmpty()) model = matchDeviceValue(friendly, "modelName");
      if (model == null || model.isEmpty()) {
        model = readShellOutputOnHost(host, 5555, "getprop ro.product.model");
      }
      String name = matchDeviceValue(friendly, "friendlyName");
      if (name == null || name.isEmpty()) {
        name = readShellOutputOnHost(host, 5555, "settings get global device_name");
      }
      if (name == null || name.isEmpty()) name = model;
      result.putString("name", name == null ? "" : name.trim());
      result.putString("model", model == null ? "" : model.trim());
      promise.resolve(result);
    });
  }

  private String readIdentityFromHttp(String host, int port) {
    int[] ports = new int[] {port, 5555, 8008, 8060, 8080, 8090, 80};
    String[] paths = new String[] {"/", "/description.xml", "/setup.xml", "/api/device", "/api/system"};
    for (int candidatePort : ports) {
      if (candidatePort <= 0) continue;
      for (String path : paths) {
        HttpURLConnection connection = null;
        try {
          URL url = new URL("http://" + host + ":" + candidatePort + path);
          connection = (HttpURLConnection) url.openConnection();
          connection.setConnectTimeout(700);
          connection.setReadTimeout(1200);
          connection.setRequestMethod("GET");
          int status = connection.getResponseCode();
          if (status < 200 || status >= 300) continue;
          BufferedReader reader = new BufferedReader(
              new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
          StringBuilder response = new StringBuilder();
          String line;
          while ((line = reader.readLine()) != null && response.length() < 16384) {
            response.append(line).append('\n');
          }
          reader.close();
          String text = response.toString();
          if (matchDeviceValue(text, "friendlyName") != null
              || matchDeviceValue(text, "modelNumber") != null
              || matchDeviceValue(text, "modelName") != null
              || text.matches("(?s).*\\b(deviceName|model|device_name)\\b.*")) {
            return text;
          }
        } catch (Throwable ignored) {
        } finally {
          if (connection != null) connection.disconnect();
        }
      }
    }
    return "";
  }

  private String matchDeviceValue(String source, String key) {
    if (source == null || source.isEmpty() || key == null) return "";
    try {
      Pattern xml = Pattern.compile("<[^>]*" + key + "[^>]*>([^<]+)</[^>]*>", Pattern.CASE_INSENSITIVE);
      Matcher xmlMatcher = xml.matcher(source);
      if (xmlMatcher.find()) return xmlMatcher.group(1).trim();
      Pattern json = Pattern.compile("[\"']" + key + "[\"']\\s*:\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
      Matcher jsonMatcher = json.matcher(source);
      if (jsonMatcher.find()) return jsonMatcher.group(1).trim();
    } catch (Throwable ignored) {
    }
    return "";
  }

  private String readShellOutputOnHost(String host, int port, String command) {
    Socket socket = null;
    try {
      socket = new Socket();
      socket.connect(new InetSocketAddress(host, port), 1800);
      socket.setSoTimeout(2200);
      OutputStream output = socket.getOutputStream();
      output.write(("shell:" + command + "\n").getBytes(StandardCharsets.UTF_8));
      output.flush();
      BufferedReader reader = new BufferedReader(
          new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
      String line;
      while ((line = reader.readLine()) != null) {
        String cleaned = line.trim();
        if (!cleaned.isEmpty() && !cleaned.startsWith("shell:")) return cleaned;
      }
    } catch (Throwable ignored) {
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (Throwable ignored) {
        }
      }
    }
    return "";
  }

  private WritableArray readInstalledPackages(String ip, int port) {
    WritableArray results = new WritableNativeArray();
    try {
      Process process;
      if (ip == null || ip.trim().isEmpty() || ip.equals("0.0.0.0")) {
        process = Runtime.getRuntime().exec(new String[] {"sh", "-c", "pm list packages -3"});
      } else {
        URL url = new URL("http://" + ip + ":" + port + "/api/apps?command=pm%20list%20packages%20-3");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(2500);
        connection.setReadTimeout(5000);
        connection.setRequestMethod("GET");
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) return results;
        process = null;
        BufferedReader reader = new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) response.append(line).append('\n');
        reader.close();
        connection.disconnect();
        appendPackages(results, response.toString());
        return results;
      }
      BufferedReader reader = new BufferedReader(
          new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
      StringBuilder response = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) response.append(line).append('\n');
      reader.close();
      process.waitFor();
      appendPackages(results, response.toString());
    } catch (Throwable error) {
      Log.w(TAG, "installed app list failed", error);
    }
    return results;
  }

  private WritableArray readInstalledPackagesFromAdbShell(String ip) {
    WritableArray results = new WritableNativeArray();
    if (ip == null || ip.trim().isEmpty() || ip.equals("0.0.0.0")) return results;
    Socket socket = null;
    try {
      socket = new Socket();
      socket.connect(new InetSocketAddress(ip, 5555), 2500);
      socket.setSoTimeout(3000);
      OutputStream output = socket.getOutputStream();
      output.write("shell:pm list packages -3\n".getBytes(StandardCharsets.UTF_8));
      output.flush();
      BufferedReader reader = new BufferedReader(
          new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
      StringBuilder response = new StringBuilder();
      String line;
      long deadline = System.currentTimeMillis() + 4000;
      while (System.currentTimeMillis() < deadline && (line = reader.readLine()) != null) {
        response.append(line).append('\n');
        if (line.trim().isEmpty()) break;
      }
      appendPackages(results, response.toString());
    } catch (Throwable error) {
      Log.w(TAG, "ADB app list failed", error);
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (Throwable ignored) {
        }
      }
    }
    return results;
  }

  private static void appendPackages(WritableArray results, String response) {
    if (response == null) return;
    Set<String> seen = new HashSet<>();
    String[] lines = response.split("\\r?\\n");
    for (String line : lines) {
      String trimmed = line.trim();
      if (trimmed.startsWith("package:")) {
        String pkg = trimmed.substring(8).trim();
        if (!pkg.isEmpty() && seen.add(pkg)) results.pushString(pkg);
      }
    }
    if (results.size() == 0) {
      Matcher matcher = Pattern.compile("\"(?:package|packageName)\"\\s*:\\s*\"([A-Za-z0-9_.]+)\"")
          .matcher(response);
      while (matcher.find()) {
        String pkg = matcher.group(1);
        if (seen.add(pkg)) results.pushString(pkg);
      }
    }
  }

  private static int[] hidKeyForChar(char c) {
    if (c >= 'a' && c <= 'z') return new int[] {0, 0x04 + (c - 'a')};
    if (c >= 'A' && c <= 'Z') return new int[] {0x02, 0x04 + (c - 'A')};
    if (c >= '0' && c <= '9') return new int[] {0, c == '0' ? 0x27 : 0x1E + (c - '1')};
    switch (c) {
      case ' ': return new int[] {0, 0x2C};
      case '\n': return new int[] {0, 0x28};
      case '\t': return new int[] {0, 0x2B};
      case '-': return new int[] {0, 0x2D};
      case '=': return new int[] {0, 0x2E};
      case '[': return new int[] {0, 0x2F};
      case ']': return new int[] {0, 0x30};
      case '\\': return new int[] {0, 0x31};
      case ';': return new int[] {0, 0x33};
      case '\'': return new int[] {0, 0x34};
      case '`': return new int[] {0, 0x35};
      case ',': return new int[] {0, 0x36};
      case '.': return new int[] {0, 0x37};
      case '/': return new int[] {0, 0x38};
      case '!': return new int[] {0x02, 0x1E};
      case '@': return new int[] {0x02, 0x1F};
      case '#': return new int[] {0x02, 0x20};
      case '$': return new int[] {0x02, 0x21};
      case '%': return new int[] {0x02, 0x22};
      case '^': return new int[] {0x02, 0x23};
      case '&': return new int[] {0x02, 0x24};
      case '*': return new int[] {0x02, 0x25};
      case '(': return new int[] {0x02, 0x26};
      case ')': return new int[] {0x02, 0x27};
      case '_': return new int[] {0x02, 0x2D};
      case '+': return new int[] {0x02, 0x2E};
      case '{': return new int[] {0x02, 0x2F};
      case '}': return new int[] {0x02, 0x30};
      case '|': return new int[] {0x02, 0x31};
      case ':': return new int[] {0x02, 0x33};
      case '"': return new int[] {0x02, 0x34};
      case '~': return new int[] {0x02, 0x35};
      case '<': return new int[] {0x02, 0x36};
      case '>': return new int[] {0x02, 0x37};
      case '?': return new int[] {0x02, 0x38};
      default: return null;
    }
  }

  @ReactMethod
  public void sendBluetoothHidText(String text, Promise promise) {
    if (text == null || text.isEmpty()) {
      promise.resolve(false);
      return;
    }
    executor.execute(() -> {
      ensureHidProxy();
      boolean sentAll = true;
      for (int i = 0; i < text.length(); i++) {
        int[] key = hidKeyForChar(text.charAt(i));
        if (key == null) continue;
        boolean down = sendKeyboardReport(key[0], key[1]);
        try {
          Thread.sleep(12);
        } catch (InterruptedException error) {
          Thread.currentThread().interrupt();
        }
        boolean up = sendKeyboardReport(0, 0);
        sentAll = sentAll && down && up;
      }
      promise.resolve(sentAll);
    });
  }

  @ReactMethod
  public void isPointerSupported(Promise promise) {
    promise.resolve(true);
  }

  @ReactMethod
  public void isAirMouseSupported(Promise promise) {
    promise.resolve(true);
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
            ReadableMap existing = results.getMap(i);
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

  @ReactMethod
  public void isBluetoothHidConnected(Promise promise) {
    promise.resolve(hidDevice != null && connectedHidDevice != null);
  }

  @ReactMethod
  public void disconnectBluetoothHid(Promise promise) {
    executor.execute(() -> {
      boolean ok = true;
      if (hidDevice != null && connectedHidDevice != null) {
        try {
          if (Build.VERSION.SDK_INT >= 31 && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            ok = false;
          } else {
            ok = hidDevice.disconnect(connectedHidDevice);
          }
        } catch (Throwable error) {
          ok = false;
        }
      }
      connectedHidDevice = null;
      promise.resolve(ok);
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
    byte[] report = new byte[4];
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
      boolean consumer = isConsumerUsage(keyCode);
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
      boolean sent = sendMouseReport(
          mouseButtons.get(), (int) Math.round(dx), (int) Math.round(dy), 0);
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
  public void startMouseDrag(String button, Promise promise) {
    executor.execute(() -> {
      int bit = "right".equalsIgnoreCase(button == null ? "" : button) ? 2 : 1;
      mouseButtons.set(bit);
      promise.resolve(sendMouseReport(bit, 0, 0, 0));
    });
  }

  @ReactMethod
  public void endMouseDrag(Promise promise) {
    executor.execute(() -> {
      mouseButtons.set(0);
      promise.resolve(sendMouseReport(0, 0, 0, 0));
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

  private static void addDiscoveredDevice(List<DiscoveredDevice> devices, DiscoveredDevice device) {
    if (device == null || device.ip == null || device.ip.isEmpty()) return;
    synchronized (devices) {
      for (DiscoveredDevice existing : devices) {
        if (existing.ip.equals(device.ip) && existing.port == device.port) return;
      }
      devices.add(device);
    }
  }

  private static String headerValue(String message, String name) {
    String[] lines = message.split("\r?\n");
    for (String line : lines) {
      int separator = line.indexOf(':');
      if (separator > 0 && line.substring(0, separator).trim().equalsIgnoreCase(name)) {
        return line.substring(separator + 1).trim();
      }
    }
    return null;
  }

  private void discoverSsdp(List<DiscoveredDevice> devices) {
    DatagramSocket socket = null;
    WifiManager.MulticastLock multicastLock = null;
    try {
      WifiManager wifi = (WifiManager) getReactApplicationContext()
          .getApplicationContext().getSystemService(Context.WIFI_SERVICE);
      if (wifi != null) {
        multicastLock = wifi.createMulticastLock("magic_ssdp_discovery");
        multicastLock.setReferenceCounted(true);
        multicastLock.acquire();
      }
    } catch (Throwable error) {
      multicastLock = null;
      Log.w(TAG, "SSDP multicast lock unavailable", error);
    }

    try {
      socket = new DatagramSocket(null);
      socket.setReuseAddress(true);
      socket.bind(new InetSocketAddress(0));
      socket.setSoTimeout(700);
      byte[] request = SSDP_REQUEST.getBytes(StandardCharsets.UTF_8);
      socket.send(new DatagramPacket(
          request, request.length, InetAddress.getByName("239.255.255.250"), 1900));

      long deadline = System.currentTimeMillis() + 2500;
      byte[] buffer = new byte[2048];
      while (System.currentTimeMillis() < deadline) {
        try {
          DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
          socket.receive(packet);
          String response = new String(
              packet.getData(), packet.getOffset(), packet.getLength(), StandardCharsets.UTF_8);
          String location = headerValue(response, "LOCATION");
          String ip = packet.getAddress().getHostAddress();
          int port = 80;
          if (location != null) {
            try {
              URL url = new URL(location);
              if (url.getHost() != null && !url.getHost().isEmpty()) ip = url.getHost();
              if (url.getPort() > 0) port = url.getPort();
            } catch (Throwable ignored) {
            }
          }
          String server = headerValue(response, "SERVER");
          String usn = headerValue(response, "USN");
          String name = server == null || server.isEmpty() ? usn : server;
          if (name == null || name.isEmpty()) name = "SSDP Device";
          addDiscoveredDevice(devices, new DiscoveredDevice(name, ip, port, "ssdp"));
        } catch (SocketTimeoutException ignored) {
        }
      }
    } catch (Throwable error) {
      Log.w(TAG, "SSDP discovery failed", error);
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (Throwable ignored) {
        }
      }
      if (multicastLock != null) {
        try {
          multicastLock.release();
        } catch (Throwable ignored) {
        }
      }
    }
  }

  private void discoverMdns(final List<DiscoveredDevice> devices) {
    final NsdManager manager = (NsdManager) getReactApplicationContext()
        .getSystemService(Context.NSD_SERVICE);
    if (manager == null) return;
    final Set<String> resolving = Collections.synchronizedSet(new HashSet<String>());

    for (final String serviceType : NSD_TYPES) {
      final CountDownLatch started = new CountDownLatch(1);
      final NsdManager.ResolveListener resolveListener = new NsdManager.ResolveListener() {
        @Override
        public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
        }

        @Override
        public void onServiceResolved(NsdServiceInfo serviceInfo) {
          InetAddress host = serviceInfo.getHost();
          if (host == null) return;
          String ip = host.getHostAddress();
          if (ip == null) return;
          int percent = ip.indexOf('%');
          if (percent > 0) ip = ip.substring(0, percent);
          int port = serviceInfo.getPort();
          if (port <= 0) port = 5555;
          String name = serviceInfo.getServiceName();
          if (name == null || name.isEmpty()) name = "mDNS Device";
          addDiscoveredDevice(devices, new DiscoveredDevice(name, ip, port, "mdns"));
        }
      };

      final NsdManager.DiscoveryListener discoveryListener = new NsdManager.DiscoveryListener() {
        @Override
        public void onDiscoveryStarted(String type) {
          started.countDown();
        }

        @Override
        public void onServiceFound(NsdServiceInfo service) {
          if (service == null) return;
          final String key = serviceType + "|" + service.getServiceName();
          if (!resolving.add(key)) return;
          try {
            manager.resolveService(service, resolveListener);
          } catch (Throwable error) {
            resolving.remove(key);
          }
        }

        @Override
        public void onServiceLost(NsdServiceInfo service) {
        }

        @Override
        public void onDiscoveryStopped(String type) {
          started.countDown();
        }

        @Override
        public void onStartDiscoveryFailed(String type, int errorCode) {
          started.countDown();
        }

        @Override
        public void onStopDiscoveryFailed(String type, int errorCode) {
          started.countDown();
        }
      };

      try {
        manager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
      } catch (Throwable error) {
        Log.w(TAG, "mDNS discovery failed for " + serviceType, error);
        continue;
      }
      try {
        started.await(1200, TimeUnit.MILLISECONDS);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
      }
      try {
        manager.stopServiceDiscovery(discoveryListener);
      } catch (Throwable ignored) {
      }
      try {
        Thread.sleep(250);
      } catch (InterruptedException error) {
        Thread.currentThread().interrupt();
      }
    }
  }

  @ReactMethod
  public void discoverNetworkDevices(Promise promise) {
    executor.execute(() -> {
      List<DiscoveredDevice> found = new ArrayList<>();
      discoverSsdp(found);
      discoverMdns(found);
      WritableArray results = new WritableNativeArray();
      synchronized (found) {
        for (DiscoveredDevice device : found) {
          WritableMap item = new WritableNativeMap();
          item.putString("name", device.name);
          item.putString("ip", device.ip);
          item.putInt("port", device.port);
          item.putString("protocol", "http");
          item.putString("source", device.source);
          results.pushMap(item);
        }
      }
      promise.resolve(results);
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
