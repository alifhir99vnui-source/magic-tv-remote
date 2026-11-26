package com.aluqabi.cinema.data.local

import android.util.Base64
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Provides salted SHA-256 password hashing and strict input validation for local accounts.
 */
object PasswordHasher {
    private val EMAIL_REGEX = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
    private val PHONE_REGEX = Regex("^\\+?[0-9]{8,15}$")

    fun isValidEmail(email: String): Boolean = EMAIL_REGEX.matches(email.trim())

    fun isValidPhone(phone: String): Boolean = PHONE_REGEX.matches(normalizePhone(phone))

    fun normalizePhone(phone: String): String =
        phone.trim().replace(" ", "").replace("-", "")

    /**
     * Validates password strength: minimum 8 characters, at least one letter and one digit.
     */
    fun isStrongPassword(password: String): Boolean {
        if (password.length < 8) return false
        val hasLetter = password.any { it.isLetter() }
        val hasDigit = password.any { it.isDigit() }
        return hasLetter && hasDigit
    }

    fun generateSalt(): String {
        val bytes = ByteArray(16)
        SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    fun hashPassword(password: String, salt: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val input = "$salt:$password".toByteArray(Charsets.UTF_8)
        val hashed = digest.digest(input)
        return Base64.encodeToString(hashed, Base64.NO_WRAP)
    }

    fun verifyPassword(password: String, salt: String, expectedHash: String): Boolean {
        val actual = hashPassword(password, salt)
        return MessageDigest.isEqual(
            actual.toByteArray(Charsets.UTF_8),
            expectedHash.toByteArray(Charsets.UTF_8)
        )
    }
}
