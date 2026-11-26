package com.aluqabi.cinema.di

import android.content.Context
import com.aluqabi.cinema.config.AppConfig
import com.aluqabi.cinema.data.local.AppDatabase
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.SupabaseSessionManager
import com.aluqabi.cinema.data.remote.SupabaseAuthService
import com.aluqabi.cinema.data.remote.SupabaseClient
import com.aluqabi.cinema.data.remote.TmdbApiService
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.CatalogRepository
import com.aluqabi.cinema.data.repository.SourcesRepository
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.createSupabaseClient
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val database: AppDatabase = AppDatabase.build(appContext)
    val settingsDataStore: SettingsDataStore = SettingsDataStore(appContext)

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private val json: Json = Json { ignoreUnknownKeys = true; isLenient = true }

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl("https://api.themoviedb.org/3/")
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val tmdbApiService: TmdbApiService = retrofit.create(TmdbApiService::class.java)
    val supabaseClient: SupabaseClient = SupabaseClient(okHttpClient)

    private val supabaseAuthClient = createSupabaseClient(
        supabaseUrl = AppConfig.SUPABASE_URL,
        supabaseKey = AppConfig.SUPABASE_ANON_KEY
    ) {
        install(Auth) {
            scheme = AppConfig.AUTH_DEEP_LINK_SCHEME
            host = AppConfig.AUTH_DEEP_LINK_HOST
            flowType = FlowType.IMPLICIT
            alwaysAutoRefresh = false
            autoLoadFromStorage = true
            autoSaveToStorage = true
            sessionManager = SupabaseSessionManager(settingsDataStore)
        }
    }

    val supabaseAuthService: SupabaseAuthService = SupabaseAuthService(supabaseAuthClient)

    val authRepository: AuthRepository = AuthRepository(
        supabase = supabaseClient,
        supabaseAuth = supabaseAuthService,
        settingsDataStore = settingsDataStore
    ).also { auth ->
        supabaseClient.tokenProvider = {
            settingsDataStore.preferences.first().accessToken.takeIf { it.isNotBlank() }
        }
        supabaseClient.tokenRefresher = { auth.refreshAccessToken() }
    }

    val sourcesRepository: SourcesRepository = SourcesRepository(
        context = appContext,
        okHttpClient = okHttpClient,
        supabase = supabaseClient,
        settingsDataStore = settingsDataStore,
        sourceDao = database.sourceDao(),
        cachedChannelDao = database.cachedChannelDao(),
        cachedCatalogDao = database.cachedCatalogDao(),
        mediaLinkOverrideDao = database.mediaLinkOverrideDao()
    )

    val catalogRepository: CatalogRepository = CatalogRepository(
        tmdbApi = tmdbApiService,
        supabase = supabaseClient,
        settingsDataStore = settingsDataStore,
        cachedCatalogDao = database.cachedCatalogDao(),
        favoriteDao = database.favoriteDao(),
        watchHistoryDao = database.watchHistoryDao(),
        sourcesRepository = sourcesRepository
    )
}
