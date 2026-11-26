package com.aluqabi.cinema.di

import android.content.Context
import com.aluqabi.cinema.data.local.AppDatabase
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.remote.TmdbApiService
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.CatalogRepository
import com.aluqabi.cinema.data.repository.SourcesRepository
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Manual dependency container providing shared singletons across ViewModels and Screens.
 */
class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val database: AppDatabase = AppDatabase.build(appContext)
    val settingsDataStore: SettingsDataStore = SettingsDataStore(appContext)

    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl("https://api.themoviedb.org/3/")
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()

    val tmdbApiService: TmdbApiService = retrofit.create(TmdbApiService::class.java)

    val authRepository: AuthRepository = AuthRepository(
        userDao = database.userDao(),
        settingsDataStore = settingsDataStore
    )

    val sourcesRepository: SourcesRepository = SourcesRepository(
        context = appContext,
        okHttpClient = okHttpClient,
        sourceDao = database.sourceDao(),
        cachedChannelDao = database.cachedChannelDao(),
        cachedCatalogDao = database.cachedCatalogDao(),
        mediaLinkOverrideDao = database.mediaLinkOverrideDao()
    )

    val catalogRepository: CatalogRepository = CatalogRepository(
        tmdbApi = tmdbApiService,
        cachedCatalogDao = database.cachedCatalogDao(),
        favoriteDao = database.favoriteDao(),
        watchHistoryDao = database.watchHistoryDao(),
        sourcesRepository = sourcesRepository
    )
}
