const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KT_MODULE = `package com.magicremote.tvremote

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import java.net.Socket
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import android.content.Intent
import android.content.IntentFilter
import android.hardware.ConsumerIrManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.wifi.WifiManager
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.Inet4Address
import java.net.NetworkInterface

class MagicControlModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), SensorEventListener {

  private var sensorManager: SensorManager? = null
  private var gyroSensor: Sensor? = null
  private var gyroActive = false
  private var btReceiver: BroadcastReceiver? = null

  override fun getName(): String = "MagicControl"

  private fun sendEvent(eventName: String, params: WritableMap?) {
    if (reactContext.hasActiveReactInstance()) {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    }
  }

  @ReactMethod
  fun getNetworkInfo(promise: Promise) {
    try {
      var ipAddress = ""
      val interfaces = NetworkInterface.getNetworkInterfaces()
      while (interfaces.hasMoreElements()) {
        val intf = interfaces.nextElement()
        if (!intf.isUp || intf.isLoopback) continue
        val addrs = intf.inetAddresses
        while (addrs.hasMoreElements()) {
          val addr = addrs.nextElement()
          if (!addr.isLoopbackAddress && addr is Inet4Address) {
            ipAddress = addr.hostAddress ?: ""
            break
          }
        }
        if (ipAddress.isNotEmpty()) break
      }

      val wifiMgr =
        reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

      @Suppress("DEPRECATION")
      val rawSsid = wifiMgr?.connectionInfo?.ssid ?: ""

      val ssid = rawSsid.trim('"').let {
        if (it == "<unknown ssid>" || it.isBlank()) "Wi-Fi Network" else it
      }

      val map = Arguments.createMap()
      map.putString("ip", ipAddress)
      map.putString("ssid", ssid)
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("NET_ERR", e.message)
    }
  }

  @ReactMethod
  fun hasIrEmitter(promise: Promise) {
    try {
      val ir =
        reactContext.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
      promise.resolve(ir?.hasIrEmitter() == true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun transmitIr(carrierFrequency: Int, pattern: ReadableArray, promise: Promise) {
    try {
      val ir =
        reactContext.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager

      if (ir == null || !ir.hasIrEmitter()) {
        promise.reject("NO_IR", "No IR emitter on this phone")
        return
      }

      val freq = if (carrierFrequency > 0) carrierFrequency else 38000
      val pulses = IntArray(pattern.size()) { i -> pattern.getInt(i) }
      ir.transmit(freq, pulses)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("IR_ERR", e.message)
    }
  }

  @ReactMethod
  fun startBluetoothScan(promise: Promise) {
    try {
      val manager =
        reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      val adapter: BluetoothAdapter? =
        manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()

      if (adapter == null || !adapter.isEnabled) {
        promise.reject("BT_OFF", "Bluetooth is disabled")
        return
      }

      adapter.bondedDevices?.forEach { dev ->
        val map = Arguments.createMap()
        map.putString("name", dev.name ?: "Paired Device")
        map.putString("address", dev.address ?: "")
        map.putBoolean("paired", true)
        sendEvent("onBluetoothDeviceFound", map)
      }

      if (btReceiver == null) {
        btReceiver = object : BroadcastReceiver() {
          override fun onReceive(context: Context?, intent: Intent?) {
            if (BluetoothDevice.ACTION_FOUND == intent?.action) {
              val device: BluetoothDevice? =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                  intent.getParcelableExtra(
                    BluetoothDevice.EXTRA_DEVICE,
                    BluetoothDevice::class.java
                  )
                } else {
                  @Suppress("DEPRECATION")
                  intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                }

              if (device != null && !device.address.isNullOrBlank()) {
                val map = Arguments.createMap()
                map.putString("name", device.name ?: "Bluetooth Device")
                map.putString("address", device.address)
                map.putBoolean(
                  "paired",
                  device.bondState == BluetoothDevice.BOND_BONDED
                )
                sendEvent("onBluetoothDeviceFound", map)
              }
            }
          }
        }

        reactContext.registerReceiver(
          btReceiver,
          IntentFilter(BluetoothDevice.ACTION_FOUND)
        )
      }

      if (adapter.isDiscovering) adapter.cancelDiscovery()
      adapter.startDiscovery()
      promise.resolve(true)
    } catch (e: SecurityException) {
      promise.reject("BT_PERM", "Bluetooth permission required")
    } catch (e: Exception) {
      promise.reject("BT_ERR", e.message)
    }
  }

  @ReactMethod
  fun startGyroscope(promise: Promise) {
    try {
      if (sensorManager == null) {
        sensorManager =
          reactContext.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        gyroSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
      }

      if (gyroSensor == null) {
        promise.resolve(false)
        return
      }

      if (!gyroActive) {
        sensorManager?.registerListener(
          this,
          gyroSensor,
          SensorManager.SENSOR_DELAY_GAME
        )
        gyroActive = true
      }

      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun stopGyroscope() {
    try {
      if (gyroActive) {
        sensorManager?.unregisterListener(this)
        gyroActive = false
      }
    } catch (_: Exception) {
    }
  }

  @ReactMethod
  fun sendBluetoothKey(key: String, promise: Promise) {
    promise.resolve(true)
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (!gyroActive || event == null) return

    val dx = (-event.values[1] * 20f).toDouble()
    val dy = (-event.values[0] * 20f).toDouble()

    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      val map = Arguments.createMap()
      map.putDouble("dx", dx)
      map.putDouble("dy", dy)
      sendEvent("onGyroDelta", map)
    }
  }

  @ReactMethod
  fun scanWifiDevices(prefix: String, promise: Promise) {
    Thread {
      val found = Arguments.createArray()
      val cleanPrefix = prefix.trim().trimEnd('.')
      val ports = intArrayOf(5555, 8080, 80, 9000)

      for (i in 1..254) {
        val candidate = "$cleanPrefix.$i"
        var reachable = false
        var openPort = 0

        for (p in ports) {
          try {
            Socket().use { sock ->
              sock.soTimeout = 120
              sock.connect(InetSocketAddress(candidate, p), 120)
              reachable = true
              openPort = p
            }

            if (reachable) break
          } catch (_: Exception) {
          }
        }

        if (reachable) {
          val item = Arguments.createMap()
          item.putString("name", "Wi-Fi Device ($candidate)")
          item.putString("address", candidate)
          item.putInt("port", openPort)
          found.pushMap(item)
        }
      }

      promise.resolve(found)
    }.start()
  }

  @ReactMethod
  fun getInstalledTvApps(ip: String, promise: Promise) {
    Thread {
      val apps = Arguments.createArray()

      try {
        Socket().use { sock ->
          sock.soTimeout = 2500
          sock.connect(InetSocketAddress(ip.trim(), 5555), 2500)

          val out = sock.getOutputStream()
          val cmd = (
            "shell:cmd package query-intent-activities -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER; " +
            "cmd package query-intent-activities -a android.intent.action.MAIN -c android.intent.category.LAUNCHER\\n"
          ).toByteArray(Charsets.UTF_8)

          val lenHex =
            String.format("%04x", cmd.size).toByteArray(Charsets.UTF_8)

          out.write("CNXN".toByteArray(Charsets.UTF_8))
          out.write(ByteArray(20))
          out.write("WRTE".toByteArray(Charsets.UTF_8))
          out.write(ByteArray(8))
          out.write(lenHex)
          out.write(cmd)
          out.flush()

          val reader = BufferedReader(
            InputStreamReader(sock.getInputStream())
          )
          val seen = HashSet<String>()
          var line: String? = reader.readLine()

          while (line != null) {
            val idx = line.indexOf("packageName=")

            if (idx != -1) {
              val pkg = line.substring(idx + 12)
                .takeWhile { it != ' ' && it != '\\n' && it != '\\r' }
                .trim()

              if (pkg.isNotEmpty() && !seen.contains(pkg)) {
                seen.add(pkg)

                val label =
                  pkg.split(".").lastOrNull()
                    ?.replaceFirstChar { it.uppercase() } ?: pkg

                val item = Arguments.createMap()
                item.putString("pkg", pkg)
                item.putString("label", label)
                apps.pushMap(item)
              }
            }

            line = reader.readLine()
          }
        }
      } catch (_: Exception) {
      }

      promise.resolve(apps)
    }.start()
  }

  @ReactMethod
  fun sendIrCode(freq: Int, patternStr: String, promise: Promise) {
    Thread {
      try {
        val irMgr =
          reactContext.getSystemService(
            Context.CONSUMER_IR_SERVICE
          ) as? ConsumerIrManager

        val parts = patternStr.split(",")
          .mapNotNull { it.trim().toIntOrNull() }
          .toIntArray()

        if (irMgr != null && irMgr.hasIrEmitter() && parts.isNotEmpty()) {
          irMgr.transmit(freq, parts)
          promise.resolve(true)
        } else {
          promise.resolve(false)
        }
      } catch (_: Exception) {
        promise.resolve(false)
      }
    }.start()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
`;

const KT_PACKAGE = `package com.magicremote.tvremote

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MagicControlPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(MagicControlModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

module.exports = function withMagicHardware(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];

    const perms = [
      'android.permission.TRANSMIT_IR',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.INTERNET',
    ];

    perms.forEach((p) => {
      if (
        !manifest['uses-permission'].some(
          (item) => item.$?.['android:name'] === p
        )
      ) {
        manifest['uses-permission'].push({
          $: { 'android:name': p },
        });
      }
    });

    return mod;
  });

  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const pkgDir = path.join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/java/com/magicremote/tvremote'
      );

      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, 'MagicControlModule.kt'),
        KT_MODULE
      );
      fs.writeFileSync(
        path.join(pkgDir, 'MagicControlPackage.kt'),
        KT_PACKAGE
      );

      const mainAppPath = path.join(pkgDir, 'MainApplication.kt');

      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf8');

        if (!content.includes('MagicControlPackage()')) {
          content = content.replace(
            /PackageList\(this\)\.packages\.apply\s*\{/,
            'PackageList(this).packages.apply {\n              add(MagicControlPackage())'
          );
          fs.writeFileSync(mainAppPath, content);
        }
      }

      return mod;
    },
  ]);
};
