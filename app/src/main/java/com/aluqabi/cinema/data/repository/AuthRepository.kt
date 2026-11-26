package com.aluqabi.cinema.data.repository

import com.aluqabi.cinema.data.local.PasswordHasher
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.dao.UserDao
import com.aluqabi.cinema.data.local.entity.UserEntity
import com.aluqabi.cinema.config.AppConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlin.random.Random

sealed interface AuthResult {
    data class Success(val user: UserEntity) : AuthResult
    data class Error(val messageAr: String, val messageEn: String) : AuthResult
}

/**
 * Handles local authentication (Email/Password, Phone OTP, Google/Facebook quick profile)
 * backed by Room and DataStore session persistence.
 */
class AuthRepository(
    private val userDao: UserDao,
    private val settingsDataStore: SettingsDataStore
) {
    private val http = OkHttpClient()
    private val jsonType = "application/json".toMediaType()
    private val avatarPalette = listOf(
        0xFFE50914L,
        0xFF1E88E5L,
        0xFF00897BL,
        0xFF8E24AAL,
        0xFFF4511EL
    )

    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val currentUser: Flow<UserEntity?> = settingsDataStore.preferences.flatMapLatest { prefs ->
        val uid = prefs.currentUserId
        if (uid == null) flowOf(null) else userDao.observeById(uid)
    }

    suspend fun signUpWithEmail(
        name: String,
        email: String,
        password: String,
        confirmPassword: String
    ): AuthResult {
        val cleanName = name.trim()
        val cleanEmail = email.trim()
        if (cleanName.length < 2) {
            return AuthResult.Error(
                "يرجى إدخال اسم لا يقل عن حرفين",
                "Please enter a name with at least 2 characters"
            )
        }
        if (!PasswordHasher.isValidEmail(cleanEmail)) {
            return AuthResult.Error(
                "صيغة البريد الإلكتروني غير صحيحة",
                "Invalid email address format"
            )
        }
        if (!PasswordHasher.isStrongPassword(password)) {
            return AuthResult.Error(
                "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام",
                "Password must be at least 8 characters and include letters and numbers"
            )
        }
        if (password != confirmPassword) {
            return AuthResult.Error(
                "كلمتا المرور غير متطابقتين",
                "Passwords do not match"
            )
        }
        return requestSupabaseAuth("/auth/v1/signup", cleanEmail, password, cleanName, createSession = false)
    }

    suspend fun signInWithEmail(email: String, password: String): AuthResult {
        val cleanEmail = email.trim()
        if (!PasswordHasher.isValidEmail(cleanEmail)) {
            return AuthResult.Error(
                "صيغة البريد الإلكتروني غير صحيحة",
                "Invalid email address format"
            )
        }
        if (password.isEmpty()) {
            return AuthResult.Error(
                "يرجى إدخال كلمة المرور",
                "Please enter your password"
            )
        }
        return requestSupabaseAuth("/auth/v1/token?grant_type=password", cleanEmail, password, createSession = true)
    }

    private suspend fun requestSupabaseAuth(
        path: String,
        email: String,
        password: String,
        name: String = "",
        createSession: Boolean
    ): AuthResult = withContext(Dispatchers.IO) {
        if (!AppConfig.isSupabaseConfigured) return@withContext AuthResult.Error(
            "لم يتم إعداد الاتصال السحابي بعد", "Cloud authentication is not configured"
        )
        try {
            val payload = JSONObject().put("email", email).put("password", password)
            if (name.isNotBlank()) payload.put("data", JSONObject().put("name", name))
            val request = Request.Builder()
                .url(AppConfig.SUPABASE_URL + path)
                .header("apikey", AppConfig.SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody(jsonType))
                .build()
            http.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                val result = JSONObject(body.ifBlank { "{}" })
                if (!response.isSuccessful) {
                    val message = result.optString("msg", result.optString("message", "Authentication failed"))
                    return@withContext AuthResult.Error(message, message)
                }
                val account = result.optJSONObject("user") ?: result
                val accountEmail = account.optString("email", email)
                val accountName = account.optJSONObject("user_metadata")?.optString("name")
                    ?.takeIf { it.isNotBlank() } ?: name.ifBlank { accountEmail.substringBefore('@') }
                if (createSession && result.optString("access_token").isBlank()) {
                    return@withContext AuthResult.Error(
                        "الحساب يحتاج إلى تأكيد البريد الإلكتروني", "Please confirm your email before signing in"
                    )
                }
                if (!createSession && result.optString("access_token").isBlank()) {
                    return@withContext AuthResult.Error(
                        "تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.",
                        "Account created. Confirm your email, then sign in."
                    )
                }
                val existing = userDao.getByEmail(accountEmail)
                val signedUser = existing?.copy(name = accountName, authProvider = "SUPABASE") ?: UserEntity(
                    name = accountName, email = accountEmail, authProvider = "SUPABASE",
                    avatarColorHex = avatarPalette.random()
                )
                val id = if (existing == null) userDao.insert(signedUser) else {
                    userDao.update(signedUser); existing.id
                }
                val saved = signedUser.copy(id = id)
                settingsDataStore.setCurrentUserId(id)
                AuthResult.Success(saved)
            }
        } catch (e: Exception) {
            AuthResult.Error("تعذر الاتصال بخدمة تسجيل الدخول", e.message ?: "Could not reach Supabase Auth")
        }
    }

    fun generateLocalOtp(): String = ""

    suspend fun signInWithPhoneOtp(
        phone: String,
        displayName: String,
        enteredCode: String,
        expectedCode: String
    ): AuthResult {
        val cleanPhone = PasswordHasher.normalizePhone(phone)
        if (!PasswordHasher.isValidPhone(cleanPhone)) return AuthResult.Error("رقم الهاتف غير صالح", "Invalid phone number")
        if (!AppConfig.isSupabaseConfigured) return AuthResult.Error("الاتصال السحابي غير مُعد", "Cloud authentication is not configured")
        return withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder().url("${AppConfig.SUPABASE_URL}/auth/v1/otp")
                    .header("apikey", AppConfig.SUPABASE_ANON_KEY).header("Content-Type", "application/json")
                    .post(JSONObject().put("phone", cleanPhone).toString().toRequestBody(jsonType)).build()
                http.newCall(request).execute().use { res ->
                    if (res.isSuccessful) AuthResult.Error("أُرسل رمز التحقق عبر SMS. أدخل الرمز لإكمال الدخول.", "SMS code sent. Enter the code to complete sign in.")
                    else AuthResult.Error("تعذر إرسال الرمز", "Could not send verification code")
                }
            } catch (_: Exception) { AuthResult.Error("تعذر الاتصال بخدمة الدخول", "Could not reach Supabase Auth") }
        }
    }

    suspend fun quickSignIn(provider: String, defaultName: String): AuthResult {
        return AuthResult.Error("تسجيل الدخول عبر $provider غير مفعّل حتى إعداد OAuth السحابي", "$provider sign-in requires configured OAuth credentials")
    }

    suspend fun updateProfile(user: UserEntity, newName: String, newEmail: String?, newPhone: String?, newAvatarColor: Long): AuthResult {
        val cleanName = newName.trim()
        if (cleanName.length < 2) {
            return AuthResult.Error("الاسم قصير جداً", "Name is too short")
        }
        val cleanEmail = newEmail?.trim()?.takeIf { it.isNotEmpty() }
        if (cleanEmail != null && !PasswordHasher.isValidEmail(cleanEmail)) {
            return AuthResult.Error("البريد الإلكتروني غير صحيح", "Invalid email format")
        }
        val cleanPhone = newPhone?.let { PasswordHasher.normalizePhone(it) }?.takeIf { it.isNotEmpty() }
        if (cleanPhone != null && !PasswordHasher.isValidPhone(cleanPhone)) {
            return AuthResult.Error("رقم الهاتف غير صحيح", "Invalid phone number")
        }
        val updated = user.copy(
            name = cleanName,
            email = cleanEmail,
            phone = cleanPhone,
            avatarColorHex = newAvatarColor
        )
        userDao.update(updated)
        return AuthResult.Success(updated)
    }

    suspend fun logout() {
        settingsDataStore.setCurrentUserId(null)
    }
}
