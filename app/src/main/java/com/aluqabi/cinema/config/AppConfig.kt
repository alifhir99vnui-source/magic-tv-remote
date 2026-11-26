package com.aluqabi.cinema.config

import com.aluqabi.cinema.BuildConfig

/**
 * Centralized developer configuration embedded into the app at build time.
 * Replace placeholders in app/build.gradle.kts or pass SUPABASE_URL, SUPABASE_ANON_KEY,
 * TMDB_API_KEY, GOOGLE_WEB_CLIENT_ID via gradle.properties / CI secrets.
 *
 * SECURITY: Never embed a Supabase service_role key in the Android client.
 */
object AppConfig {
    val SUPABASE_URL: String = BuildConfig.SUPABASE_URL.trim().trimEnd('/')
    val SUPABASE_ANON_KEY: String = BuildConfig.SUPABASE_ANON_KEY.trim()
    val TMDB_API_KEY: String = BuildConfig.TMDB_API_KEY.trim()
    val GOOGLE_WEB_CLIENT_ID: String = BuildConfig.GOOGLE_WEB_CLIENT_ID.trim()

    const val SUPABASE_PROJECT_REF = "lsqpmchchaujrjoldbyl"
    const val FACEBOOK_APP_ID = "1695851235579606"
    const val AUTH_DEEP_LINK_SCHEME = "cinealuqabi"
    const val AUTH_DEEP_LINK_HOST = "auth-callback"
    const val AUTH_REDIRECT_URL = "$AUTH_DEEP_LINK_SCHEME://$AUTH_DEEP_LINK_HOST"

    val isSupabaseConfigured: Boolean
        get() = SUPABASE_URL.startsWith("https://") &&
            !SUPABASE_URL.contains("YOUR_PROJECT_REF", ignoreCase = true) &&
            SUPABASE_ANON_KEY.isNotBlank() &&
            !SUPABASE_ANON_KEY.contains("YOUR_SUPABASE", ignoreCase = true)

    val isTmdbConfigured: Boolean
        get() = TMDB_API_KEY.isNotBlank() && !TMDB_API_KEY.contains("YOUR_TMDB", ignoreCase = true)

    val isGoogleSignInConfigured: Boolean
        get() = GOOGLE_WEB_CLIENT_ID.isNotBlank() &&
            !GOOGLE_WEB_CLIENT_ID.contains("YOUR_GOOGLE_WEB_CLIENT_ID", ignoreCase = true)

    val isFacebookSignInConfigured: Boolean
        get() = isSupabaseConfigured &&
            FACEBOOK_APP_ID.isNotBlank() &&
            SUPABASE_URL.contains(SUPABASE_PROJECT_REF, ignoreCase = true)
}
