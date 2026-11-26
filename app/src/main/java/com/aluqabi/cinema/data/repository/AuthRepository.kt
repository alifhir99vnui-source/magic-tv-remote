package com.aluqabi.cinema.data.repository

import android.content.Intent
import com.aluqabi.cinema.config.AppConfig
import com.aluqabi.cinema.data.local.PasswordHasher
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.remote.SupabaseAuthService
import com.aluqabi.cinema.data.remote.SupabaseClient
import com.aluqabi.cinema.data.remote.asArrOrEmpty
import com.aluqabi.cinema.data.remote.asObjOrNull
import com.aluqabi.cinema.data.remote.bool
import com.aluqabi.cinema.data.remote.long
import com.aluqabi.cinema.data.remote.str
import com.aluqabi.cinema.domain.model.UserProfile
import com.aluqabi.cinema.domain.model.UserRole
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

sealed interface AuthResult {
    data class Success(val profile: UserProfile) : AuthResult
    data class Error(val messageAr: String, val messageEn: String) : AuthResult
    data class Info(val messageAr: String, val messageEn: String) : AuthResult
}

class AuthRepository(
    private val supabase: SupabaseClient,
    private val supabaseAuth: SupabaseAuthService,
    private val settingsDataStore: SettingsDataStore
) {
    private val oauthScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _oauthResult = MutableStateFlow<AuthResult?>(null)
    val oauthResult: StateFlow<AuthResult?> = _oauthResult.asStateFlow()

    fun consumeOAuthResult() { _oauthResult.value = null }

    fun cancelOAuth() {
        _oauthResult.value = AuthResult.Error("تم إلغاء تسجيل الدخول", "Sign-in cancelled")
    }

    fun handleOAuthIntent(intent: Intent) {
        val data = intent.data ?: return
        if (data.scheme?.lowercase() != AppConfig.AUTH_DEEP_LINK_SCHEME) return
        if (data.host != null && data.host != AppConfig.AUTH_DEEP_LINK_HOST) return
        val error = data.getQueryParameter("error")
            ?: data.fragment?.split("&")?.firstOrNull { it.startsWith("error=") }?.removePrefix("error=")
        if (!error.isNullOrBlank()) {
            _oauthResult.value = AuthResult.Error(
                "تعذر تسجيل الدخول: $error",
                "Sign-in failed: $error"
            )
            return
        }
        if (data.query.isNullOrBlank() && data.fragment.isNullOrBlank()) return
        supabaseAuth.handleDeeplink(intent) { session ->
            oauthScope.launch {
                runCatching {
                    val userId = session.user?.id.orEmpty()
                    if (userId.isNotBlank()) {
                        settingsDataStore.setSession(session.accessToken, session.refreshToken, userId)
                    }
                    ensureProfileExists()
                    val profile = refreshCurrentProfile()
                    _oauthResult.value = if (profile != null) {
                        AuthResult.Success(profile)
                    } else {
                        AuthResult.Error("تم الدخول لكن تعذر تحميل الملف الشخصي", "Signed in but failed to load profile")
                    }
                }.onFailure {
                    _oauthResult.value = AuthResult.Error(
                        it.message ?: "فشل تسجيل الدخول",
                        it.message ?: "Sign-in failed"
                    )
                }
            }
        }
    }

    suspend fun signInWithFacebook(): AuthResult {
        if (!AppConfig.isFacebookSignInConfigured) return AuthResult.Error("لم يتم إعداد تسجيل الدخول بفيسبوك", "Facebook sign-in is not configured")
        return try {
            supabaseAuth.signInWithFacebook()
            AuthResult.Info("جارٍ فتح نافذة تسجيل الدخول...", "Opening sign-in window...")
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "فشل تسجيل الدخول بفيسبوك", e.message ?: "Facebook sign-in failed")
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    val currentProfile: Flow<UserProfile?> = settingsDataStore.preferences.flatMapLatest { prefs ->
        if (!prefs.isLoggedIn) flowOf(null)
        else flow { emit(fetchProfile(prefs.userId, prefs.accessToken).getOrNull()) }
    }

    suspend fun refreshCurrentProfile(): UserProfile? {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return null
        val first = fetchProfile(prefs.userId, prefs.accessToken)
        if (first.isSuccess) return first.getOrNull()
        if (refreshAccessToken()) {
            val refreshedPrefs = settingsDataStore.preferences.first()
            if (refreshedPrefs.isLoggedIn) {
                return fetchProfile(refreshedPrefs.userId, refreshedPrefs.accessToken).getOrNull()
            }
        }
        return null
    }


    suspend fun signUpWithEmail(name: String, email: String, password: String, confirmPassword: String): AuthResult {
        val cleanName = name.trim()
        val cleanEmail = email.trim()
        if (cleanName.length < 2) return AuthResult.Error("يرجى إدخال اسم لا يقل عن حرفين", "Please enter a name with at least 2 characters")
        if (!PasswordHasher.isValidEmail(cleanEmail)) return AuthResult.Error("صيغة البريد الإلكتروني غير صحيحة", "Invalid email address format")
        if (!PasswordHasher.isStrongPassword(password)) return AuthResult.Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام", "Password must be at least 8 characters and include letters and numbers")
        if (password != confirmPassword) return AuthResult.Error("كلمتا المرور غير متطابقتين", "Passwords do not match")
        if (!AppConfig.isSupabaseConfigured) return AuthResult.Error("لم يتم إعداد Supabase", "Supabase is not configured")

        return try {
            supabaseAuth.signUpWithEmail(cleanEmail, password, cleanName)
            if (settingsDataStore.preferences.first().isLoggedIn) {
                ensureProfileExists()
                val profile = refreshCurrentProfile()
                if (profile != null) AuthResult.Success(profile)
                else AuthResult.Info("تم إنشاء الحساب", "Account created")
            } else {
                AuthResult.Info(
                    "تم إنشاء الحساب. أكّد بريدك الإلكتروني ثم سجّل الدخول.",
                    "Account created. Confirm your email, then sign in."
                )
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "فشل إنشاء الحساب", e.message ?: "Sign up failed")
        }
    }

    suspend fun signInWithEmail(email: String, password: String): AuthResult {
        val cleanEmail = email.trim()
        if (!PasswordHasher.isValidEmail(cleanEmail)) return AuthResult.Error("صيغة البريد الإلكتروني غير صحيحة", "Invalid email address format")
        if (password.isBlank()) return AuthResult.Error("يرجى إدخال كلمة المرور", "Please enter your password")
        if (!AppConfig.isSupabaseConfigured) return AuthResult.Error("لم يتم إعداد Supabase", "Supabase is not configured")

        return try {
            supabaseAuth.signInWithEmail(cleanEmail, password)
            ensureProfileExists()
            val profile = refreshCurrentProfile()
            if (profile != null) AuthResult.Success(profile)
            else AuthResult.Error("تم الدخول لكن تعذر تحميل الملف الشخصي", "Signed in but failed to load profile")
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "فشل تسجيل الدخول", e.message ?: "Sign in failed")
        }
    }

    suspend fun signInWithGoogleIdToken(idToken: String): AuthResult {
        if (!AppConfig.isSupabaseConfigured) return AuthResult.Error("لم يتم إعداد Supabase", "Supabase is not configured")
        if (idToken.isBlank()) return AuthResult.Error("تعذر الحصول على بيانات جوجل", "Could not get Google credentials")
        return try {
            supabaseAuth.signInWithGoogle(idToken)
            ensureProfileExists()
            val profile = refreshCurrentProfile()
            if (profile != null) AuthResult.Success(profile)
            else AuthResult.Error("تم تسجيل الدخول لكن تعذر تحميل الملف الشخصي", "Signed in but failed to load profile")
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "فشل تسجيل الدخول بجوجل", e.message ?: "Google sign-in failed")
        }
    }

    suspend fun signOut() {
        runCatching { supabaseAuth.clearSession() }
        settingsDataStore.setSession(null, null, null)
    }

    suspend fun refreshAccessToken(): Boolean {
        val prefs = settingsDataStore.preferences.first()
        val refreshToken = prefs.refreshToken
        if (refreshToken.isBlank()) return false
        if (!AppConfig.isSupabaseConfigured) return false
        if (runCatching { supabaseAuth.refreshSession() }.getOrDefault(false)) {
            return settingsDataStore.preferences.first().isLoggedIn
        }
        val res = supabase.authPost(
            "/auth/v1/token?grant_type=refresh_token",
            buildJsonObject { put("refresh_token", refreshToken) }
        )
        return res.fold(
            onSuccess = { obj ->
                saveSessionFromAuth(obj)
                settingsDataStore.preferences.first().isLoggedIn
            },
            onFailure = { false }
        )
    }

    private suspend fun saveSessionFromAuth(obj: JsonObject) {
        val accessToken = obj.str("access_token")
        val previousRefreshToken = settingsDataStore.preferences.first().refreshToken
        val refreshToken = obj.str("refresh_token").ifBlank { previousRefreshToken }
        val user = obj["user"]?.asObjOrNull()
        val userId = user?.str("id").orEmpty().ifBlank { obj.str("user_id") }
        if (accessToken.isNotBlank() && userId.isNotBlank()) {
            settingsDataStore.setSession(accessToken, refreshToken, userId)
        }
    }

    private suspend fun ensureProfileExists() {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return
        val existing = supabase.restGet("profiles?id=eq.${prefs.userId}&select=id", prefs.accessToken)
        val hasRow = existing.getOrNull()?.asArrOrEmpty()?.isNotEmpty() == true
        if (!hasRow) {
            val user = supabase.authGet("/auth/v1/user", prefs.accessToken).getOrNull()
            val meta = user?.get("user_metadata")?.asObjOrNull()
            val name = meta?.str("name").orEmpty().ifBlank { meta?.str("full_name").orEmpty() }.ifBlank { "User" }
            val email = user?.str("email").orEmpty()
            val phone = user?.str("phone").orEmpty()
            supabase.restPost(
                "profiles",
                buildJsonObject {
                    put("id", prefs.userId)
                    put("email", email)
                    put("phone", phone)
                    put("name", name)
                    put("role", "user")
                },
                prefs.accessToken,
                prefer = "resolution=merge-duplicates,return=minimal"
            )
        }
    }

    suspend fun fetchProfile(userId: String, accessToken: String): Result<UserProfile> = withContext(Dispatchers.IO) {
        supabase.restGet("profiles?id=eq.$userId&select=*", accessToken).mapCatching { el ->
            val row = el.asArrOrEmpty().firstOrNull()?.asObjOrNull() ?: error("Profile not found")
            row.toProfile()
        }
    }

    suspend fun updateProfile(name: String, email: String?, phone: String?, avatarColor: Long): AuthResult {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return AuthResult.Error("يجب تسجيل الدخول", "You must be signed in")
        val cleanName = name.trim()
        if (cleanName.length < 2) return AuthResult.Error("الاسم قصير جداً", "Name is too short")
        val cleanEmail = email?.trim()?.takeIf { it.isNotEmpty() }
        val cleanPhone = phone?.trim()?.takeIf { it.isNotEmpty() }
        if (cleanEmail != null && !PasswordHasher.isValidEmail(cleanEmail)) return AuthResult.Error("البريد الإلكتروني غير صحيح", "Invalid email")
        if (cleanPhone != null && !PasswordHasher.isValidPhone(cleanPhone)) return AuthResult.Error("رقم الهاتف غير صحيح", "Invalid phone")

        val res = supabase.restPatch(
            "profiles?id=eq.${prefs.userId}",
            buildJsonObject {
                put("name", cleanName)
                if (cleanEmail != null) put("email", cleanEmail)
                if (cleanPhone != null) put("phone", cleanPhone)
                put("avatar_color", avatarColor)
            },
            prefs.accessToken
        )
        return res.fold(
            onSuccess = {
                val profile = refreshCurrentProfile()
                if (profile != null) AuthResult.Success(profile) else AuthResult.Error("تعذر تحديث الملف الشخصي", "Profile update failed")
            },
            onFailure = { AuthResult.Error(it.message ?: "تعذر التحديث", it.message ?: "Update failed") }
        )
    }

    suspend fun adminSearchUsers(query: String): Result<List<UserProfile>> {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return Result.failure(IllegalStateException("Not signed in"))
        var activePrefs = prefs
        var current = fetchProfile(activePrefs.userId, activePrefs.accessToken).getOrNull()
        if (current == null && refreshAccessToken()) {
            activePrefs = settingsDataStore.preferences.first()
            current = if (activePrefs.isLoggedIn) fetchProfile(activePrefs.userId, activePrefs.accessToken).getOrNull() else null
        }
        if (current?.isAdmin != true) return Result.failure(IllegalStateException("Admin access required"))
        return supabase.rpc(
            "search_profiles",
            buildJsonObject { put("search_text", query.trim()) },
            activePrefs.accessToken
        ).map { el -> el.asArrOrEmpty().mapNotNull { it.asObjOrNull()?.toProfile() } }
    }

    suspend fun adminSetRole(userId: String, role: UserRole): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return Result.failure(IllegalStateException("Not signed in"))
        return supabase.restPatch(
            "profiles?id=eq.$userId",
            buildJsonObject { put("role", role.name.lowercase()) },
            prefs.accessToken
        ).map { }
    }

    suspend fun adminSetBanned(userId: String, banned: Boolean): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        if (!prefs.isLoggedIn) return Result.failure(IllegalStateException("Not signed in"))
        return supabase.restPatch(
            "profiles?id=eq.$userId",
            buildJsonObject { put("is_banned", banned) },
            prefs.accessToken
        ).map { }
    }

    private fun JsonObject.toProfile(): UserProfile = UserProfile(
        id = str("id"),
        email = str("email"),
        phone = str("phone"),
        name = str("name").ifBlank { "User" },
        role = UserRole.from(str("role")),
        isBanned = bool("is_banned"),
        avatarColor = long("avatar_color").takeIf { it != 0L } ?: 0xFFE50914L
    )
}
