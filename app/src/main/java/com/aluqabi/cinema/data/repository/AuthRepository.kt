package com.aluqabi.cinema.data.repository

import com.aluqabi.cinema.data.local.PasswordHasher
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.dao.UserDao
import com.aluqabi.cinema.data.local.entity.UserEntity
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
        if (userDao.getByEmail(cleanEmail) != null) {
            return AuthResult.Error(
                "هذا البريد الإلكتروني مسجل مسبقاً",
                "An account with this email already exists"
            )
        }

        val salt = PasswordHasher.generateSalt()
        val hash = PasswordHasher.hashPassword(password, salt)
        val user = UserEntity(
            name = cleanName,
            email = cleanEmail,
            passwordHash = hash,
            passwordSalt = salt,
            authProvider = "EMAIL",
            avatarColorHex = avatarPalette.random()
        )
        val newId = userDao.insert(user)
        val saved = user.copy(id = newId)
        settingsDataStore.setCurrentUserId(newId)
        return AuthResult.Success(saved)
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
        val user = userDao.getByEmail(cleanEmail)
            ?: return AuthResult.Error(
                "لا يوجد حساب بهذا البريد الإلكتروني",
                "No account found for this email"
            )
        val verified = PasswordHasher.verifyPassword(password, user.passwordSalt, user.passwordHash)
        if (!verified) {
            return AuthResult.Error(
                "كلمة المرور غير صحيحة",
                "Incorrect password"
            )
        }
        settingsDataStore.setCurrentUserId(user.id)
        return AuthResult.Success(user)
    }

    fun generateLocalOtp(): String = Random.nextInt(100000, 999999).toString()

    suspend fun signInWithPhoneOtp(
        phone: String,
        displayName: String,
        enteredCode: String,
        expectedCode: String
    ): AuthResult {
        val cleanPhone = PasswordHasher.normalizePhone(phone)
        if (!PasswordHasher.isValidPhone(cleanPhone)) {
            return AuthResult.Error(
                "رقم الهاتف غير صالح (8 إلى 15 رقماً)",
                "Invalid phone number (8 to 15 digits)"
            )
        }
        if (enteredCode.trim() != expectedCode || expectedCode.isBlank()) {
            return AuthResult.Error(
                "رمز التحقق غير صحيح",
                "Verification code is incorrect"
            )
        }
        val existing = userDao.getByPhone(cleanPhone)
        val user = if (existing != null) {
            existing
        } else {
            val newUser = UserEntity(
                name = displayName.trim().ifBlank { "مستخدم $cleanPhone" },
                phone = cleanPhone,
                authProvider = "PHONE",
                avatarColorHex = avatarPalette.random()
            )
            val id = userDao.insert(newUser)
            newUser.copy(id = id)
        }
        settingsDataStore.setCurrentUserId(user.id)
        return AuthResult.Success(user)
    }

    suspend fun quickSignIn(provider: String, defaultName: String): AuthResult {
        val normalizedProvider = provider.uppercase()
        val existing = userDao.getByProvider(normalizedProvider)
        val user = if (existing != null) {
            existing
        } else {
            val newUser = UserEntity(
                name = defaultName,
                email = "${normalizedProvider.lowercase()}@local.cinema",
                authProvider = normalizedProvider,
                avatarColorHex = if (normalizedProvider == "GOOGLE") 0xFF1E88E5L else 0xFF1877F2L
            )
            val id = userDao.insert(newUser)
            newUser.copy(id = id)
        }
        settingsDataStore.setCurrentUserId(user.id)
        return AuthResult.Success(user)
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
