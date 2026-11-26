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
import kotlinx.coroutines.flow.map

private val Context.cinemaDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "al_uqabi_cinema_prefs"
)

data class AppPreferences(
    val currentUserId: Long? = null,
    val languageCode: String = "ar",
    val tmdbApiKey: String = "",
    val subtitleFontSizeSp: Float = 18f,
    val subtitleTextColorArgb: Long = 0xFFFFFFFFL,
    val subtitleBgColorArgb: Long = 0x99000000L,
    val defaultAspectMode: String = "FIT"
)

/**
 * Manages persisted app preferences, session state, TMDB API key, and subtitle appearance.
 */
class SettingsDataStore(private val context: Context) {

    private object Keys {
        val CURRENT_USER_ID = longPreferencesKey("current_user_id")
        val LANGUAGE_CODE = stringPreferencesKey("language_code")
        val TMDB_API_KEY = stringPreferencesKey("tmdb_api_key")
        val SUBTITLE_FONT_SIZE = floatPreferencesKey("subtitle_font_size")
        val SUBTITLE_TEXT_COLOR = longPreferencesKey("subtitle_text_color")
        val SUBTITLE_BG_COLOR = longPreferencesKey("subtitle_bg_color")
        val DEFAULT_ASPECT_MODE = stringPreferencesKey("default_aspect_mode")
    }

    val preferences: Flow<AppPreferences> = context.cinemaDataStore.data.map { prefs ->
        AppPreferences(
            currentUserId = prefs[Keys.CURRENT_USER_ID],
            languageCode = prefs[Keys.LANGUAGE_CODE] ?: "ar",
            tmdbApiKey = prefs[Keys.TMDB_API_KEY] ?: "",
            subtitleFontSizeSp = prefs[Keys.SUBTITLE_FONT_SIZE] ?: 18f,
            subtitleTextColorArgb = prefs[Keys.SUBTITLE_TEXT_COLOR] ?: 0xFFFFFFFFL,
            subtitleBgColorArgb = prefs[Keys.SUBTITLE_BG_COLOR] ?: 0x99000000L,
            defaultAspectMode = prefs[Keys.DEFAULT_ASPECT_MODE] ?: "FIT"
        )
    }

    suspend fun setCurrentUserId(userId: Long?) {
        context.cinemaDataStore.edit { prefs ->
            if (userId == null) {
                prefs.remove(Keys.CURRENT_USER_ID)
            } else {
                prefs[Keys.CURRENT_USER_ID] = userId
            }
        }
    }

    suspend fun setLanguageCode(languageCode: String) {
        context.cinemaDataStore.edit { prefs ->
            prefs[Keys.LANGUAGE_CODE] = languageCode
        }
    }

    suspend fun setTmdbApiKey(apiKey: String) {
        context.cinemaDataStore.edit { prefs ->
            prefs[Keys.TMDB_API_KEY] = apiKey.trim()
        }
    }

    suspend fun updateSubtitleStyle(
        fontSizeSp: Float,
        textColorArgb: Long,
        bgColorArgb: Long
    ) {
        context.cinemaDataStore.edit { prefs ->
            prefs[Keys.SUBTITLE_FONT_SIZE] = fontSizeSp.coerceIn(12f, 34f)
            prefs[Keys.SUBTITLE_TEXT_COLOR] = textColorArgb
            prefs[Keys.SUBTITLE_BG_COLOR] = bgColorArgb
        }
    }

    suspend fun setDefaultAspectMode(mode: String) {
        context.cinemaDataStore.edit { prefs ->
            prefs[Keys.DEFAULT_ASPECT_MODE] = mode
        }
    }
}
