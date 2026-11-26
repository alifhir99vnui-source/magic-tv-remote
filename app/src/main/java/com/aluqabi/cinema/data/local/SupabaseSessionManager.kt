package com.aluqabi.cinema.data.local

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
private data class StoredSession(
    val accessToken: String = "",
    val refreshToken: String = "",
    val userId: String = "",
    val expiresAtMillis: Long = 0L
)

class SupabaseSessionManager(private val settingsDataStore: SettingsDataStore) : SessionManager {

    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }

    override suspend fun saveSession(session: UserSession) {
        val prefs = settingsDataStore.preferences.first()
        val userId = session.user?.id.orEmpty().ifBlank { prefs.userId }
        val stored = StoredSession(
            accessToken = session.accessToken,
            refreshToken = session.refreshToken,
            userId = userId
        )
        settingsDataStore.setSupabaseSession(json.encodeToString(stored))
        settingsDataStore.setSession(stored.accessToken, stored.refreshToken, userId)
    }

    override suspend fun loadSession(): UserSession? {
        val prefs = settingsDataStore.preferences.first()
        val stored = settingsDataStore.getSupabaseSession()?.takeIf { it.isNotBlank() }?.let {
            runCatching { json.decodeFromString<StoredSession>(it) }.getOrNull()
        }
        val accessToken = stored?.accessToken?.takeIf { it.isNotBlank() } ?: prefs.accessToken
        val refreshToken = stored?.refreshToken?.takeIf { it.isNotBlank() } ?: prefs.refreshToken
        if (accessToken.isBlank() && refreshToken.isBlank()) return null
        return UserSession(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresIn = 3600L,
            tokenType = "Bearer",
            user = null
        )
    }

    override suspend fun deleteSession() {
        settingsDataStore.setSupabaseSession(null)
        settingsDataStore.setSession(null, null, null)
    }
}
