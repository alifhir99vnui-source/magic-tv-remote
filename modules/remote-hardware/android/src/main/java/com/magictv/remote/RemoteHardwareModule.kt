package com.magictv.remote

import android.Manifest
import android.bluetooth.*
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.tananaev.adblib.AdbBase64
import com.tananaev.adblib.AdbConnection
import com.tananaev.adblib.AdbCrypto
import com.tananaev.adblib.AdbStream
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class RemoteHardwareModule : Module() {
  private val worker = Executors.newCachedThreadPool()
  private val scanWorker = Executors.newFixedThreadPool(24)
  private val main = Handler(Looper.getMainLooper())
  private var hid: BluetoothHidDevice? = null
  private var registered = false
  private var connected: BluetoothDevice? = null
  private var discoveryReceiver: BroadcastReceiver? = null
  private val adbLock = Any()
  private var adbConnection: AdbConnection? = null
  private var adbSocket: Socket? = null
  private var adbHost: String? = null
  private val reportDescriptor = byteArrayOf(0x05,0x01,0x09,0x06,0xA1.toByte(),0x01,0x85.toByte(),0x01,0x05,0x07,0x19,0xE0.toByte(),0x29,0xE7.toByte(),0x15,0x00,0x25,0x01,0x75,0x01,0x95,0x08,0x81.toByte(),0x02,0x95,0x01,0x75,0x08,0x81.toByte(),0x01,0x95,0x05,0x75,0x01,0x05,0x08,0x19,0x01,0x29,0x05,0x91.toByte(),0x02,0x95,0x01,0x75,0x03,0x91.toByte(),0x01,0x95,0x06,0x75,0x08,0x15,0x00,0x25,0x65,0x05,0x07,0x19,0x00,0x29,0x65,0x81.toByte(),0x00,0xC0.toByte(),0x05,0x0C,0x09,0x01,0xA1.toByte(),0x01,0x85.toByte(),0x02,0x15,0x00,0x26,0xFF.toByte(),0x03,0x19,0x00,0x2A,0xFF.toByte(),0x03,0x75,0x10,0x95,0x01,0x81.toByte(),0x00,0xC0.toByte())

  override fun definition() = ModuleDefinition {
    Name("RemoteHardware")
    Events("onBluetoothDevice", "onHidState")

    AsyncFunction("probeAdb") { host: String, timeoutMs: Int ->
      try {
        val auth = probeAdbProtocol(host, timeoutMs.coerceIn(300, 3000))
        mapOf("reachable" to true, "host" to host, "port" to 5555, "authenticated" to false, "meaning" to if (auth) "ADB_AUTH_REQUIRED" else "ADB_RESPONSIVE")
      } catch (_: Exception) { mapOf("reachable" to false, "host" to host, "port" to 5555, "authenticated" to false) }
    }
    AsyncFunction("connectAdb") { host: String ->
      synchronized(adbLock) {
        val oldConnection = if (adbHost == host) adbConnection else null
        if (oldConnection != null) {
          try { runOnAdbConnection(oldConnection, "true") } catch (_: Exception) { disconnectAdbLocked() }
        }
        connectAdbLocked(host)
      }
      true
    }
    AsyncFunction("pingAdb") { host: String ->
      synchronized(adbLock) {
        val connection = adbConnection
        if (adbHost != host || connection == null) false
        else try { runOnAdbConnection(connection, "true"); true }
        catch (_: Exception) { disconnectAdbLocked(); false }
      }
    }
    AsyncFunction("sendAdbKey") { host: String, key: String ->
      val keyCodes = mapOf("UP" to 19, "DOWN" to 20, "LEFT" to 21, "RIGHT" to 22, "OK" to 23, "BACK" to 4, "HOME" to 3, "MENU" to 82, "POWER" to 26, "MUTE" to 91, "VOLDOWN" to 25, "VOLUP" to 24, "CHDOWN" to 167, "CHUP" to 166, "SEARCH" to 84)
      val command = if (key == "VOICE") "am start -a android.search.action.GLOBAL_SEARCH; input keyevent 84" else "input keyevent ${keyCodes[key] ?: throw Exception("Unsupported Android key") }"
      runAdbCommand(host, command)
      true
    }
    AsyncFunction("disconnectAdb") { synchronized(adbLock) { disconnectAdbLocked() }; true }
    AsyncFunction("scanAdb") { prefix: String ->
      try {
        require(prefix.matches(Regex("^(?:\\d{1,3}\\.){3}$"))) { "Expected IPv4 prefix, e.g. 192.168.1." }
        require(prefix.dropLast(1).split('.').all { it.toInt() in 0..255 }) { "IPv4 octets must be between 0 and 255" }
        val hits = java.util.Collections.synchronizedList(mutableListOf<String>())
        val jobs = (1..254).map { n -> scanWorker.submit { val ip = prefix + n; try { probeAdbProtocol(ip,700); hits.add(ip) } catch (_: Exception) {} } }
        jobs.forEach { it.get() }
        hits.sortedBy { it.substringAfterLast('.').toIntOrNull() ?: 0 }
      } catch (e: Exception) { throw Exception(e.message ?: "ADB network scan failed", e) }
    }
    AsyncFunction("startBluetooth") { promise: expo.modules.kotlin.Promise ->
      val needed = arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE)
      if (!hasPermissions(*needed)) {
        promise.reject("PERMISSION", "Grant Nearby devices, Bluetooth scan, and advertising permissions before connecting", null)
        return@AsyncFunction
      }
      val completed = AtomicBoolean(false)
      try {
        val context = appContext.reactContext ?: throw Exception("Android context is unavailable")
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
          ?: throw Exception("Bluetooth service is unavailable")
        val adapter = manager.adapter ?: throw Exception("Bluetooth is not available on this phone")
        if (!adapter.isEnabled) throw Exception("Enable Bluetooth, then scan again")
        main.postDelayed({
          if (completed.compareAndSet(false, true)) {
            promise.reject("HID_UNAVAILABLE", "This phone did not provide the Bluetooth HID Device profile", null)
          }
        }, 8000)
        val listener = object : BluetoothProfile.ServiceListener {
          override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
            if (completed.get()) return
            try {
              if (!hasPermissions(*needed)) throw SecurityException("Bluetooth permissions were revoked")
              val hidDevice = proxy as? BluetoothHidDevice ?: throw Exception("Android returned an incompatible Bluetooth profile")
              hid = hidDevice
              val sdp = BluetoothHidDeviceAppSdpSettings("Magic TV Remote", "Android TV HID Remote", "Magic Remote", BluetoothHidDevice.SUBCLASS1_KEYBOARD, reportDescriptor)
              val callback = object : BluetoothHidDevice.Callback() {
                override fun onAppStatusChanged(device: BluetoothDevice?, plugged: Boolean) {
                  try {
                    if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) return
                    registered = plugged
                    emitSafely("onHidState", mapOf("registered" to plugged, "connected" to (connected != null)))
                  } catch (_: Exception) { registered = false }
                }
                override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
                  try {
                    if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) { connected = null; return }
                    if (state == BluetoothProfile.STATE_CONNECTED) connected = device
                    else if (state == BluetoothProfile.STATE_DISCONNECTED) connected = null
                    emitSafely("onHidState", mapOf("registered" to registered, "connected" to (connected != null)))
                  } catch (_: Exception) { connected = null }
                }
              }
              val accepted = hidDevice.registerApp(sdp, null, null, worker, callback)
              if (completed.compareAndSet(false, true)) {
                if (accepted) promise.resolve(true)
                else promise.reject("HID_REGISTER", "Android rejected the HID profile registration", null)
              }
            } catch (e: Exception) {
              registered = false
              hid = null
              if (completed.compareAndSet(false, true)) promise.reject("HID_START", e.message ?: "Could not start Bluetooth HID", e)
            }
          }
          override fun onServiceDisconnected(profile: Int) {
            try {
              hid = null; registered = false; connected = null
              if (completed.compareAndSet(false, true)) promise.reject("HID_UNAVAILABLE", "Bluetooth HID Device profile disconnected", null)
            } catch (_: Exception) { }
          }
        }
        val requested = adapter.getProfileProxy(context, listener, BluetoothProfile.HID_DEVICE)
        if (!requested && completed.compareAndSet(false, true)) {
          promise.reject("HID_UNAVAILABLE", "Android could not open the Bluetooth HID Device profile", null)
        }
      } catch (e: Exception) {
        if (completed.compareAndSet(false, true)) promise.reject("HID_START", e.message ?: "Bluetooth initialization failed", e)
      }
    }
    AsyncFunction("makeBluetoothDiscoverable") {
      try {
        if (!hasPermission(Manifest.permission.BLUETOOTH_ADVERTISE)) throw SecurityException("Grant Bluetooth advertising permission first")
        val activity = appContext.currentActivity ?: throw Exception("Open the app in the foreground to enable Bluetooth discovery")
        val intent = Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE).putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 180)
        activity.startActivity(intent)
        true
      } catch (e: Exception) { throw Exception(e.message ?: "Could not enable Bluetooth discovery", e) }
    }
    AsyncFunction("scanBluetooth") { promise: expo.modules.kotlin.Promise ->
      if (!hasPermissions(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)) {
        promise.reject("PERMISSION", "Grant Nearby devices and Bluetooth scan permissions before scanning", null)
        return@AsyncFunction
      }
      val context = appContext.reactContext
      if (context == null) { promise.reject("CONTEXT", "Android context is unavailable", null); return@AsyncFunction }
      try {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
          ?: throw Exception("Bluetooth service is unavailable")
        val adapter = manager.adapter ?: throw Exception("Bluetooth is not available on this phone")
        if (!adapter.isEnabled) throw Exception("Enable Bluetooth, then scan again")
        discoveryReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
        val receiver = object : BroadcastReceiver() {
          override fun onReceive(c: Context, intent: Intent) {
            try {
              if (!hasPermissions(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)) return
              val device = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                else intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
              if (device != null) publishBluetoothDevice(device, false)
            } catch (_: Exception) { }
          }
        }
        discoveryReceiver = receiver
        val filter = IntentFilter(BluetoothDevice.ACTION_FOUND)
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        else context.registerReceiver(receiver, filter)
        adapter.bondedDevices.forEach { publishBluetoothDevice(it, true) }
        if (!adapter.startDiscovery()) throw Exception("Android could not start Bluetooth discovery")
        main.postDelayed({
          try { discoveryReceiver?.let { context.unregisterReceiver(it) } } catch (_: Exception) { }
          discoveryReceiver = null
          promise.resolve(true)
        }, 12000)
      } catch (e: Exception) {
        discoveryReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
        discoveryReceiver = null
        promise.reject("SCAN", e.message ?: "Bluetooth scan failed", e)
      }
    }
    AsyncFunction("connectBluetooth") { address: String ->
      if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) throw SecurityException("Nearby devices permission required")
      try {
        val context = appContext.reactContext ?: throw Exception("Android context is unavailable")
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: throw Exception("Bluetooth service is unavailable")
        val adapter = manager.adapter ?: throw Exception("Bluetooth is not available on this phone")
        if (!adapter.isEnabled) throw Exception("Enable Bluetooth, then connect again")
        val device = adapter.getRemoteDevice(address)
        if (device.bondState != BluetoothDevice.BOND_BONDED) throw Exception("Pair this phone from the TV Bluetooth settings first")
        val hidDevice = hid ?: throw Exception("HID profile is not registered")
        if (!registered) throw Exception("HID profile is not registered")
        hidDevice.connect(device)
      } catch (e: Exception) { throw Exception(e.message ?: "Bluetooth connection failed", e) }
    }
    AsyncFunction("sendKey") { key: String ->
      if (!hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) throw SecurityException("Nearby devices permission required")
      try {
      val d = connected ?: throw Exception("No connected Bluetooth HID host")
      val keyboard = mapOf("UP" to 0x52, "DOWN" to 0x51, "LEFT" to 0x50, "RIGHT" to 0x4F, "OK" to 0x28, "MENU" to 0x65)
      val consumer = mapOf("POWER" to 0x0030, "MUTE" to 0x00E2, "VOLDOWN" to 0x00EA, "VOLUP" to 0x00E9, "CHDOWN" to 0x009D, "CHUP" to 0x009C, "SEARCH" to 0x0221, "HOME" to 0x0223, "BACK" to 0x0224)
      val k = keyboard[key]
      val c = consumer[key]
      if (k == null && c == null) throw Exception("This HID key is not supported")
      val reportId = if (c != null) 2 else 1
      val report = if (c != null) byteArrayOf((c and 0xff).toByte(), ((c shr 8) and 0xff).toByte()) else byteArrayOf(0,k!!.toByte(),0,0,0,0,0,0)
      val empty = if (c != null) byteArrayOf(0,0) else byteArrayOf(0,0,0,0,0,0,0,0)
      val hidDevice = hid ?: throw Exception("HID profile is not available")
      val ok = hidDevice.sendReport(d, reportId, report)
      main.postDelayed({
        try { if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) hid?.sendReport(d,reportId,empty) }
        catch (_: Exception) { }
      }, 40)
      ok
      } catch (e: Exception) { throw Exception(e.message ?: "Bluetooth key send failed", e) }
    }
    OnDestroy {
      try { discoveryReceiver?.let { appContext.reactContext?.unregisterReceiver(it) } } catch (_: Exception) { }
      try { if (hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) hid?.unregisterApp() } catch (_: Exception) { }
      synchronized(adbLock) { try { disconnectAdbLocked() } catch (_: Exception) { } }
      scanWorker.shutdownNow()
      worker.shutdownNow()
    }
  }
  private fun hasPermissions(vararg permissions: String): Boolean = permissions.all { hasPermission(it) }

  private fun emitSafely(event: String, payload: Map<String, Any?>) {
    try { sendEvent(event, payload) } catch (_: Exception) { }
  }

  private fun publishBluetoothDevice(device: BluetoothDevice, bonded: Boolean) {
    try {
      if (!hasPermissions(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)) return
      emitSafely("onBluetoothDevice", mapOf("name" to (device.name ?: "Bluetooth device"), "address" to device.address, "bonded" to bonded))
    } catch (_: Exception) { }
  }

  private fun adbCommand(text: String): Int = (text[0].code) or (text[1].code shl 8) or (text[2].code shl 16) or (text[3].code shl 24)

  private fun probeAdbProtocol(host: String, timeoutMs: Int): Boolean {
    val socket = Socket()
    try {
      socket.connect(InetSocketAddress(host, 5555), timeoutMs)
      socket.soTimeout = timeoutMs
      val payload = "host::\u0000".toByteArray(Charsets.UTF_8)
      val cmd = adbCommand("CNXN")
      val sum = payload.fold(0L) { acc, byte -> acc + (byte.toInt() and 0xff) }.toInt()
      val header = java.nio.ByteBuffer.allocate(24).order(java.nio.ByteOrder.LITTLE_ENDIAN)
        .putInt(cmd).putInt(0x01000001).putInt(4096).putInt(payload.size).putInt(sum).putInt(cmd.inv()).array()
      socket.getOutputStream().apply { write(header); write(payload); flush() }
      val responseHeader = ByteArray(24)
      java.io.DataInputStream(socket.getInputStream()).readFully(responseHeader)
      val packet = java.nio.ByteBuffer.wrap(responseHeader).order(java.nio.ByteOrder.LITTLE_ENDIAN)
      val responseCommand = packet.int
      packet.int // arg0
      packet.int // arg1
      val length = packet.int
      val checksum = packet.int
      val magic = packet.int
      if (magic != responseCommand.inv() || length !in 0..65536) return false
      val data = ByteArray(length)
      if (length > 0) java.io.DataInputStream(socket.getInputStream()).readFully(data)
      val actualChecksum = data.fold(0L) { acc, byte -> acc + (byte.toInt() and 0xff) }.toInt()
      if (actualChecksum != checksum) return false
      return responseCommand == adbCommand("CNXN") || responseCommand == adbCommand("AUTH")
    } finally { try { socket.close() } catch (_: Exception) {} }
  }

  private fun adbCrypto(): AdbCrypto {
    val context = appContext.reactContext ?: throw Exception("Android context unavailable")
    val privateKey = File(context.filesDir, "magic-adbkey")
    val publicKey = File(context.filesDir, "magic-adbkey.pub")
    val base64 = object : AdbBase64 {
      override fun encodeToString(data: ByteArray): String = Base64.encodeToString(data, Base64.NO_WRAP)
    }
    if (privateKey.exists() && publicKey.exists()) return AdbCrypto.loadAdbKeyPair(base64, privateKey, publicKey)
    val crypto = AdbCrypto.generateAdbKeyPair(base64)
    crypto.saveAdbKeyPair(privateKey, publicKey)
    return crypto
  }

  private fun connectAdbLocked(host: String) {
    if (!host.matches(Regex("^(?:\\d{1,3}\\.){3}\\d{1,3}$"))) throw Exception("أدخل عنوان IPv4 صحيحاً")
    if (adbHost == host && adbConnection != null && adbSocket?.isConnected == true && adbSocket?.isClosed == false) return
    disconnectAdbLocked()
    val socket = Socket()
    var connection: AdbConnection? = null
    try {
      socket.connect(InetSocketAddress(host, 5555), 2500)
      socket.tcpNoDelay = true
      connection = AdbConnection.create(socket, adbCrypto())
      val authenticated = connection.connect(25, TimeUnit.SECONDS, false)
      if (!authenticated) throw Exception("ADB did not authenticate; accept the RSA key prompt on the TV and retry")
      adbSocket = socket
      adbConnection = connection
      adbHost = host
    } catch (e: Exception) {
      try { connection?.close() } catch (_: Exception) {}
      try { socket.close() } catch (_: Exception) {}
      if (e.message?.contains("ADB did not authenticate") == true) throw e
      throw Exception(e.message ?: "ADB connection failed; enable TCP debugging on port 5555")
    }
  }

  private fun runAdbCommand(host: String, command: String) {
    synchronized(adbLock) {
      connectAdbLocked(host)
      val connection = adbConnection ?: throw Exception("ADB session is not connected")
      try { runOnAdbConnection(connection, command) }
      catch (e: Exception) {
        disconnectAdbLocked()
        throw Exception(e.message ?: "ADB command failed")
      }
    }
  }

  private fun runOnAdbConnection(connection: AdbConnection, command: String) {
    var stream: AdbStream? = null
    try {
      stream = connection.open("shell:$command")
      while (true) {
        try { stream.read() } catch (e: IOException) {
          if (e.message != "Stream closed") throw e
          break
        }
      }
    } finally { try { stream?.close() } catch (_: Exception) {} }
  }

  private fun disconnectAdbLocked() {
    try { adbConnection?.close() } catch (_: Exception) {}
    try { adbSocket?.close() } catch (_: Exception) {}
    adbConnection = null
    adbSocket = null
    adbHost = null
  }

  private fun hasPermission(p: String): Boolean = try {
    Build.VERSION.SDK_INT < 31 || appContext.reactContext?.checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED
  } catch (_: Exception) { false }
}
