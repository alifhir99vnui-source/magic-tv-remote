package com.aluqabi.cinema.data.repository

import android.content.Context
import android.net.Uri
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.dao.CachedCatalogDao
import com.aluqabi.cinema.data.local.dao.CachedChannelDao
import com.aluqabi.cinema.data.local.dao.MediaLinkOverrideDao
import com.aluqabi.cinema.data.local.dao.SourceDao
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.CachedChannelEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.remote.SupabaseClient
import com.aluqabi.cinema.data.remote.arr
import com.aluqabi.cinema.data.remote.asArrOrEmpty
import com.aluqabi.cinema.data.remote.asObjOrNull
import com.aluqabi.cinema.data.remote.double
import com.aluqabi.cinema.data.remote.intOrNull
import com.aluqabi.cinema.data.remote.str
import com.aluqabi.cinema.data.source.JsonCatalogParser
import com.aluqabi.cinema.data.source.SourceMatcher
import com.aluqabi.cinema.domain.model.CatalogItemPayload
import com.aluqabi.cinema.domain.model.LiveChannelItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.domain.model.SourceType
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.SubtitleTrackOption
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import okhttp3.OkHttpClient
import okhttp3.Request

class SourcesRepository(
    private val context: Context,
    private val okHttpClient: OkHttpClient,
    private val supabase: SupabaseClient,
    private val settingsDataStore: SettingsDataStore,
    private val sourceDao: SourceDao,
    private val cachedChannelDao: CachedChannelDao,
    private val cachedCatalogDao: CachedCatalogDao,
    private val mediaLinkOverrideDao: MediaLinkOverrideDao
) {
    val sources: Flow<List<SourceEntity>> = sourceDao.observeAll()

    val liveChannels: Flow<List<LiveChannelItem>> = cachedChannelDao.observeActiveChannels().map { list ->
        list.map {
            LiveChannelItem(id = it.id, name = it.name, groupTitle = it.groupTitle, logoUrl = it.logoUrl, streamUrl = it.streamUrl, tvgId = it.tvgId)
        }
    }

    val customCatalogItems: Flow<List<CachedCatalogItemEntity>> = cachedCatalogDao.observeActiveItems()

    suspend fun refreshCloudContent(): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() }
            val catalogRes = supabase.restGet("movies_catalog?select=*&order=created_at.desc", token).getOrThrow()
            val channelsRes = supabase.restGet("live_channels?select=*&is_active=eq.true&order=created_at.desc", token).getOrThrow()

            cachedCatalogDao.deleteBySourceId(CLOUD_SOURCE_ID)
            cachedChannelDao.deleteBySourceId(CLOUD_SOURCE_ID)

            val catalogRows = catalogRes.asArrOrEmpty().mapNotNull { it.asObjOrNull() }
            val catalogEntities = catalogRows.map { row ->
                val qualities = parseQualities(row.arr("qualities"), row.str("stream_url"))
                val subtitles = parseSubtitles(row.arr("subtitles"))
                val payload = CatalogItemPayload(
                    streamUrl = row.str("stream_url"),
                    qualities = qualities,
                    subtitles = subtitles
                )
                CachedCatalogItemEntity(
                    sourceId = CLOUD_SOURCE_ID,
                    tmdbId = row.intOrNull("tmdb_id"),
                    mediaType = row.str("media_type").ifBlank { "MOVIE" },
                    title = row.str("title"),
                    titleAr = row.str("title_ar"),
                    originalTitle = row.str("original_title"),
                    overview = row.str("overview"),
                    posterUrl = row.str("poster_url"),
                    backdropUrl = row.str("backdrop_url"),
                    year = row.str("year"),
                    rating = row.double("rating"),
                    genres = row.arr("genres").mapNotNull { g -> g.asObjOrNull()?.str("name") ?: g.toString().trim('"').takeIf { s -> s.isNotBlank() && s != "null" } }.joinToString(","),
                    payloadJson = JsonCatalogParser.encodePayload(payload)
                )
            }
            if (catalogEntities.isNotEmpty()) cachedCatalogDao.insertAll(catalogEntities)

            val channelEntities = channelsRes.asArrOrEmpty().mapNotNull { it.asObjOrNull() }.mapIndexed { idx, row ->
                CachedChannelEntity(
                    id = (CLOUD_SOURCE_ID * 100000 + idx + 1),
                    sourceId = CLOUD_SOURCE_ID,
                    name = row.str("name"),
                    groupTitle = row.str("group_title").ifBlank { "General" },
                    logoUrl = row.str("logo_url"),
                    streamUrl = row.str("stream_url"),
                    tvgId = row.str("id")
                )
            }
            if (channelEntities.isNotEmpty()) cachedChannelDao.insertAll(channelEntities)
            Unit
        }
    }

    private fun parseQualities(arr: JsonArray, fallbackUrl: String): List<StreamQualityOption> {
        val parsed = arr.mapNotNull { el ->
            val obj = el.asObjOrNull() ?: return@mapNotNull null
            val url = obj.str("url").ifBlank { obj.str("stream_url") }
            if (url.isBlank()) null else StreamQualityOption(obj.str("label").ifBlank { "Auto" }, url)
        }
        return parsed.ifEmpty { if (fallbackUrl.isNotBlank()) listOf(StreamQualityOption("Auto", fallbackUrl)) else emptyList() }
    }

    private fun parseSubtitles(arr: JsonArray): List<SubtitleTrackOption> {
        return arr.mapNotNull { el ->
            val obj = el.asObjOrNull() ?: return@mapNotNull null
            val url = obj.str("url")
            if (url.isBlank()) null else SubtitleTrackOption(obj.str("label").ifBlank { "Subtitle" }, obj.str("language").ifBlank { "ar" }, url)
        }
    }

    // Admin cloud CRUD
    suspend fun adminUpsertCatalogItem(payload: JsonObject, existingId: String?): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return if (existingId.isNullOrBlank()) {
            supabase.restPost("movies_catalog", payload, token).map { }
        } else {
            supabase.restPatch("movies_catalog?id=eq.$existingId", payload, token).map { }
        }
    }

    suspend fun adminDeleteCatalogItem(id: String): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return supabase.restDelete("movies_catalog?id=eq.$id", token).map { }
    }

    suspend fun adminUpsertEpisode(payload: JsonObject, existingId: String?): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return if (existingId.isNullOrBlank()) supabase.restPost("series_episodes", payload, token).map { }
        else supabase.restPatch("series_episodes?id=eq.$existingId", payload, token).map { }
    }

    suspend fun adminDeleteEpisode(id: String): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return supabase.restDelete("series_episodes?id=eq.$id", token).map { }
    }

    suspend fun adminUpsertChannel(payload: JsonObject, existingId: String?): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return if (existingId.isNullOrBlank()) supabase.restPost("live_channels", payload, token).map { }
        else supabase.restPatch("live_channels?id=eq.$existingId", payload, token).map { }
    }

    suspend fun adminDeleteChannel(id: String): Result<Unit> {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return Result.failure(IllegalStateException("Not signed in"))
        return supabase.restDelete("live_channels?id=eq.$id", token).map { }
    }

    suspend fun adminListCatalog(): Result<List<JsonObject>> = withContext(Dispatchers.IO) {
        val prefs = settingsDataStore.preferences.first()
        supabase.restGet("movies_catalog?select=*&order=created_at.desc&limit=200", prefs.accessToken.takeIf { it.isNotBlank() })
            .map { it.asArrOrEmpty().mapNotNull { e -> e.asObjOrNull() } }
    }

    suspend fun adminListChannels(): Result<List<JsonObject>> = withContext(Dispatchers.IO) {
        val prefs = settingsDataStore.preferences.first()
        supabase.restGet("live_channels?select=*&order=created_at.desc&limit=200", prefs.accessToken.takeIf { it.isNotBlank() })
            .map { it.asArrOrEmpty().mapNotNull { e -> e.asObjOrNull() } }
    }

    // Legacy local source methods kept for compatibility but not exposed in user UI
    suspend fun addAndSyncSource(name: String, type: SourceType, url: String): Result<SourceEntity> = withContext(Dispatchers.IO) {
        val entity = SourceEntity(name = name.trim().ifBlank { type.name }, type = type.name, url = url.trim(), isEnabled = true)
        val id = sourceDao.insert(entity)
        syncSource(entity.copy(id = id))
    }
    suspend fun updateAndSyncSource(source: SourceEntity): Result<SourceEntity> = withContext(Dispatchers.IO) { sourceDao.update(source); syncSource(source) }
    suspend fun toggleSourceEnabled(source: SourceEntity, enabled: Boolean) { sourceDao.update(source.copy(isEnabled = enabled)) }
    suspend fun deleteSource(sourceId: Long) { cachedChannelDao.deleteBySourceId(sourceId); cachedCatalogDao.deleteBySourceId(sourceId); sourceDao.deleteById(sourceId) }

    suspend fun syncSource(source: SourceEntity): Result<SourceEntity> = withContext(Dispatchers.IO) {
        runCatching {
            val type = runCatching { SourceType.valueOf(source.type) }.getOrDefault(SourceType.M3U_PLAYLIST)
            val count = when (type) {
                SourceType.M3U_PLAYLIST -> {
                    val raw = fetchTextFromUrlOrUri(source.url)
                    val entries = com.aluqabi.cinema.data.source.M3uParser.parse(raw, defaultGroup = source.name)
                    cachedChannelDao.deleteBySourceId(source.id); cachedCatalogDao.deleteBySourceId(source.id)
                    cachedChannelDao.insertAll(entries.map { CachedChannelEntity(sourceId = source.id, name = it.name, groupTitle = it.groupTitle, logoUrl = it.logoUrl, streamUrl = it.streamUrl, tvgId = it.tvgId) })
                    entries.size
                }
                SourceType.JSON_CATALOG -> {
                    val raw = fetchTextFromUrlOrUri(source.url)
                    val parsed = JsonCatalogParser.parse(raw)
                    cachedChannelDao.deleteBySourceId(source.id); cachedCatalogDao.deleteBySourceId(source.id)
                    if (parsed.channels.isNotEmpty()) cachedChannelDao.insertAll(parsed.channels.map { CachedChannelEntity(sourceId = source.id, name = it.name, groupTitle = it.groupTitle, logoUrl = it.logoUrl, streamUrl = it.streamUrl, tvgId = it.tvgId) })
                    if (parsed.items.isNotEmpty()) cachedCatalogDao.insertAll(parsed.items.map { CachedCatalogItemEntity(sourceId = source.id, tmdbId = it.tmdbId, mediaType = it.mediaType, title = it.title, titleAr = it.titleAr, originalTitle = it.originalTitle, overview = it.overview, posterUrl = it.posterUrl, backdropUrl = it.backdropUrl, year = it.year, rating = it.rating, genres = it.genres.joinToString(","), payloadJson = JsonCatalogParser.encodePayload(it.payload)) })
                    parsed.items.size + parsed.channels.size
                }
                SourceType.DIRECT_STREAM -> {
                    cachedChannelDao.deleteBySourceId(source.id); cachedCatalogDao.deleteBySourceId(source.id)
                    cachedCatalogDao.insertAll(listOf(CachedCatalogItemEntity(sourceId = source.id, mediaType = MediaType.MOVIE.name, title = source.name, payloadJson = JsonCatalogParser.encodePayload(CatalogItemPayload(streamUrl = source.url)))))
                    1
                }
            }
            val updated = source.copy(itemCount = count, lastSyncedAt = System.currentTimeMillis(), lastError = null)
            sourceDao.update(updated); updated
        }.onFailure { err -> sourceDao.update(source.copy(lastError = err.message ?: "Sync failed")) }
    }

    suspend fun syncAllEnabledSources() = withContext(Dispatchers.IO) { sourceDao.getEnabledSources().forEach { syncSource(it) } }

    suspend fun resolvePlayback(mediaType: MediaType, tmdbId: Int?, title: String, originalTitle: String, seasonNumber: Int? = null, episodeNumber: Int? = null, fallbackKey: String = title): ResolvedPlayback = withContext(Dispatchers.IO) {
        val key = SourceMatcher.buildMediaKey(mediaType, tmdbId, fallbackKey, seasonNumber, episodeNumber)
        val override = mediaLinkOverrideDao.getByKey(key)
        SourceMatcher.resolve(mediaType, tmdbId, title, originalTitle, seasonNumber, episodeNumber, override, cachedCatalogDao.getActiveItems(), cachedChannelDao.getActiveChannels())
    }

    suspend fun saveManualLinkOverride(mediaType: MediaType, tmdbId: Int?, fallbackKey: String, seasonNumber: Int? = null, episodeNumber: Int? = null, streamUrl: String, subtitleUrl: String, qualityLabel: String = "Manual") = withContext(Dispatchers.IO) {
        val key = SourceMatcher.buildMediaKey(mediaType, tmdbId, fallbackKey, seasonNumber, episodeNumber)
        mediaLinkOverrideDao.upsert(MediaLinkOverrideEntity(mediaKey = key, tmdbId = tmdbId, mediaType = mediaType.name, seasonNumber = seasonNumber, episodeNumber = episodeNumber, streamUrl = streamUrl.trim(), subtitleUrl = subtitleUrl.trim(), qualityLabel = qualityLabel.ifBlank { "Manual" }))
    }

    suspend fun fetchTextFromUrlOrUri(location: String): String = withContext(Dispatchers.IO) {
        if (location.startsWith("content://") || location.startsWith("file://")) {
            val uri = Uri.parse(location)
            context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: error("Unable to read selected file")
        } else {
            val request = Request.Builder().url(location).build()
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) error("HTTP ${response.code}: ${response.message}")
                response.body?.string().orEmpty()
            }
        }
    }

    companion object { const val CLOUD_SOURCE_ID = -1000L }
}
