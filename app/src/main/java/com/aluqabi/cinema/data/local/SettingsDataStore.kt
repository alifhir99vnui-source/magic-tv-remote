package com.aluqabi.cinema.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.cinemaDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "al_uqabi_cinema_prefs"
)

data class AppPreferences(
    val accessToken: String = "",
    val refreshToken: String = "",
    val userId: String = "",
    val languageCode: String = "ar",
    val subtitleFontSizeSp: Float = 18f,
    val subtitleTextColorArgb: Long = 0xFFFFFFFFL,
    val subtitleBgColorArgb: Long = 0x99000000L,
    val defaultAspectMode: String = "FIT"
) {
    val isLoggedIn: Boolean get() = accessToken.isNotBlank() && userId.isNotBlank()
}

/**
 * Persists session tokens, language, and subtitle appearance.
 * Developer keys/sources are embedded via AppConfig, not user-editable.
 */
class SettingsDataStore(private val context: Context) {

    private object Keys {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val LANGUAGE_CODE = stringPreferencesKey("language_code")
        val SUBTITLE_FONT_SIZE = floatPreferencesKey("subtitle_font_size")
        val SUBTITLE_TEXT_COLOR = longPreferencesKey("subtitle_text_color")
        val SUBTITLE_BG_COLOR = longPreferencesKey("subtitle_bg_color")
        val DEFAULT_ASPECT_MODE = stringPreferencesKey("default_aspect_mode")
        val SUPABASE_SESSION = stringPreferencesKey("supabase_session")
    }

    val preferences: Flow<AppPreferences> = context.cinemaDataStore.data.map { prefs ->
        AppPreferences(
            accessToken = prefs[Keys.ACCESS_TOKEN] ?: "",
            refreshToken = prefs[Keys.REFRESH_TOKEN] ?: "",
            userId = prefs[Keys.USER_ID] ?: "",
            languageCode = prefs[Keys.LANGUAGE_CODE] ?: "ar",
            subtitleFontSizeSp = prefs[Keys.SUBTITLE_FONT_SIZE] ?: 18f,
            subtitleTextColorArgb = prefs[Keys.SUBTITLE_TEXT_COLOR] ?: 0xFFFFFFFFL,
            subtitleBgColorArgb = prefs[Keys.SUBTITLE_BG_COLOR] ?: 0x99000000L,
            defaultAspectMode = prefs[Keys.DEFAULT_ASPECT_MODE] ?: "FIT"
        )
    }

    suspend fun setSession(accessToken: String?, refreshToken: String?, userId: String?) {
        context.cinemaDataStore.edit { prefs ->
            if (accessToken.isNullOrBlank() || userId.isNullOrBlank()) {
                prefs.remove(Keys.ACCESS_TOKEN)
                prefs.remove(Keys.REFRESH_TOKEN)
                prefs.remove(Keys.USER_ID)
            } else {
                prefs[Keys.ACCESS_TOKEN] = accessToken
                prefs[Keys.REFRESH_TOKEN] = refreshToken.orEmpty()
                prefs[Keys.USER_ID] = userId
            }
        }
    }

    suspend fun getSupabaseSession(): String? = context.cinemaDataStore.data.map { it[Keys.SUPABASE_SESSION] }.first()

    suspend fun setSupabaseSession(sessionJson: String?) {
        context.cinemaDataStore.edit { prefs ->
            if (sessionJson.isNullOrBlank()) prefs.remove(Keys.SUPABASE_SESSION)
            else prefs[Keys.SUPABASE_SESSION] = sessionJson
        }
    }

    suspend fun setLanguageCode(languageCode: String) {
        context.cinemaDataStore.edit { prefs -> prefs[Keys.LANGUAGE_CODE] = languageCode }
    }

    suspend fun updateSubtitleStyle(fontSizeSp: Float, textColorArgb: Long, bgColorArgb: Long) {
        context.cinemaDataStore.edit { prefs ->
            prefs[Keys.SUBTITLE_FONT_SIZE] = fontSizeSp.coerceIn(12f, 34f)
            prefs[Keys.SUBTITLE_TEXT_COLOR] = textColorArgb
            prefs[Keys.SUBTITLE_BG_COLOR] = bgColorArgb
        }
    }

    suspend fun setDefaultAspectMode(mode: String) {
        context.cinemaDataStore.edit { prefs -> prefs[Keys.DEFAULT_ASPECT_MODE] = mode }
    }

    suspend fun clearCacheOnly() {
        // Session/language/subtitle preserved; cache clearing handled by Room/repositories.
    }
}
