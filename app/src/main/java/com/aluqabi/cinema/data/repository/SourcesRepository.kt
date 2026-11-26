package com.aluqabi.cinema.data.repository

import android.content.Context
import android.net.Uri
import com.aluqabi.cinema.data.local.dao.CachedCatalogDao
import com.aluqabi.cinema.data.local.dao.CachedChannelDao
import com.aluqabi.cinema.data.local.dao.MediaLinkOverrideDao
import com.aluqabi.cinema.data.local.dao.SourceDao
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.CachedChannelEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.source.JsonCatalogParser
import com.aluqabi.cinema.data.source.M3uParser
import com.aluqabi.cinema.data.source.SourceMatcher
import com.aluqabi.cinema.domain.model.CatalogItemPayload
import com.aluqabi.cinema.domain.model.LiveChannelItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.domain.model.SourceType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Manages user-configured M3U playlists, JSON catalogs, direct stream links,
 * and automatic playback URL matching.
 */
class SourcesRepository(
    private val context: Context,
    private val okHttpClient: OkHttpClient,
    private val sourceDao: SourceDao,
    private val cachedChannelDao: CachedChannelDao,
    private val cachedCatalogDao: CachedCatalogDao,
    private val mediaLinkOverrideDao: MediaLinkOverrideDao
) {
    val sources: Flow<List<SourceEntity>> = sourceDao.observeAll()

    val liveChannels: Flow<List<LiveChannelItem>> = cachedChannelDao.observeActiveChannels().map { list ->
        list.map {
            LiveChannelItem(
                id = it.id,
                name = it.name,
                groupTitle = it.groupTitle,
                logoUrl = it.logoUrl,
                streamUrl = it.streamUrl,
                tvgId = it.tvgId
            )
        }
    }

    val customCatalogItems: Flow<List<CachedCatalogItemEntity>> = cachedCatalogDao.observeActiveItems()

    suspend fun addAndSyncSource(
        name: String,
        type: SourceType,
        url: String
    ): Result<SourceEntity> = withContext(Dispatchers.IO) {
        val cleanName = name.trim().ifBlank { type.name }
        val cleanUrl = url.trim()
        if (cleanUrl.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Source URL cannot be empty"))
        }
        val entity = SourceEntity(
            name = cleanName,
            type = type.name,
            url = cleanUrl,
            isEnabled = true
        )
        val id = sourceDao.insert(entity)
        syncSource(entity.copy(id = id))
    }

    suspend fun updateAndSyncSource(source: SourceEntity): Result<SourceEntity> = withContext(Dispatchers.IO) {
        sourceDao.update(source)
        syncSource(source)
    }

    suspend fun toggleSourceEnabled(source: SourceEntity, enabled: Boolean) {
        sourceDao.update(source.copy(isEnabled = enabled))
    }

    suspend fun deleteSource(sourceId: Long) {
        cachedChannelDao.deleteBySourceId(sourceId)
        cachedCatalogDao.deleteBySourceId(sourceId)
        sourceDao.deleteById(sourceId)
    }

    suspend fun syncSource(source: SourceEntity): Result<SourceEntity> = withContext(Dispatchers.IO) {
        runCatching {
            val type = runCatching { SourceType.valueOf(source.type) }.getOrDefault(SourceType.M3U_PLAYLIST)
            val count = when (type) {
                SourceType.M3U_PLAYLIST -> {
                    val raw = fetchTextFromUrlOrUri(source.url)
                    val entries = M3uParser.parse(raw, defaultGroup = source.name)
                    cachedChannelDao.deleteBySourceId(source.id)
                    cachedCatalogDao.deleteBySourceId(source.id)
                    cachedChannelDao.insertAll(
                        entries.map {
                            CachedChannelEntity(
                                sourceId = source.id,
                                name = it.name,
                                groupTitle = it.groupTitle,
                                logoUrl = it.logoUrl,
                                streamUrl = it.streamUrl,
                                tvgId = it.tvgId
                            )
                        }
                    )
                    entries.size
                }
                SourceType.JSON_CATALOG -> {
                    val raw = fetchTextFromUrlOrUri(source.url)
                    val parsed = JsonCatalogParser.parse(raw)
                    cachedChannelDao.deleteBySourceId(source.id)
                    cachedCatalogDao.deleteBySourceId(source.id)
                    if (parsed.channels.isNotEmpty()) {
                        cachedChannelDao.insertAll(
                            parsed.channels.map {
                                CachedChannelEntity(
                                    sourceId = source.id,
                                    name = it.name,
                                    groupTitle = it.groupTitle,
                                    logoUrl = it.logoUrl,
                                    streamUrl = it.streamUrl,
                                    tvgId = it.tvgId
                                )
                            }
                        )
                    }
                    if (parsed.items.isNotEmpty()) {
                        cachedCatalogDao.insertAll(
                            parsed.items.map {
                                CachedCatalogItemEntity(
                                    sourceId = source.id,
                                    tmdbId = it.tmdbId,
                                    mediaType = it.mediaType,
                                    title = it.title,
                                    titleAr = it.titleAr,
                                    originalTitle = it.originalTitle,
                                    overview = it.overview,
                                    posterUrl = it.posterUrl,
                                    backdropUrl = it.backdropUrl,
                                    year = it.year,
                                    rating = it.rating,
                                    genres = it.genres.joinToString(","),
                                    payloadJson = JsonCatalogParser.encodePayload(it.payload)
                                )
                            }
                        )
                    }
                    parsed.items.size + parsed.channels.size
                }
                SourceType.DIRECT_STREAM -> {
                    cachedChannelDao.deleteBySourceId(source.id)
                    cachedCatalogDao.deleteBySourceId(source.id)
                    val isLiveHint = source.url.contains(".m3u8", ignoreCase = true) ||
                        source.name.contains("TV", ignoreCase = true) ||
                        source.name.contains("Live", ignoreCase = true) ||
                        source.name.contains("بث")
                    if (isLiveHint) {
                        cachedChannelDao.insertAll(
                            listOf(
                                CachedChannelEntity(
                                    sourceId = source.id,
                                    name = source.name,
                                    groupTitle = "Direct",
                                    logoUrl = "",
                                    streamUrl = source.url
                                )
                            )
                        )
                    } else {
                        val payload = CatalogItemPayload(streamUrl = source.url)
                        cachedCatalogDao.insertAll(
                            listOf(
                                CachedCatalogItemEntity(
                                    sourceId = source.id,
                                    mediaType = MediaType.MOVIE.name,
                                    title = source.name,
                                    payloadJson = JsonCatalogParser.encodePayload(payload)
                                )
                            )
                        )
                    }
                    1
                }
            }
            val updated = source.copy(
                itemCount = count,
                lastSyncedAt = System.currentTimeMillis(),
                lastError = null
            )
            sourceDao.update(updated)
            updated
        }.onFailure { err ->
            sourceDao.update(source.copy(lastError = err.message ?: "Sync failed"))
        }
    }

    suspend fun syncAllEnabledSources() = withContext(Dispatchers.IO) {
        sourceDao.getEnabledSources().forEach { syncSource(it) }
    }

    suspend fun resolvePlayback(
        mediaType: MediaType,
        tmdbId: Int?,
        title: String,
        originalTitle: String,
        seasonNumber: Int? = null,
        episodeNumber: Int? = null,
        fallbackKey: String = title
    ): ResolvedPlayback = withContext(Dispatchers.IO) {
        val key = SourceMatcher.buildMediaKey(mediaType, tmdbId, fallbackKey, seasonNumber, episodeNumber)
        val override = mediaLinkOverrideDao.getByKey(key)
        val catalogItems = cachedCatalogDao.getActiveItems()
        val channels = cachedChannelDao.getActiveChannels()
        SourceMatcher.resolve(
            mediaType = mediaType,
            tmdbId = tmdbId,
            title = title,
            originalTitle = originalTitle,
            seasonNumber = seasonNumber,
            episodeNumber = episodeNumber,
            overrideEntity = override,
            catalogItems = catalogItems,
            m3uEntries = channels
        )
    }

    suspend fun saveManualLinkOverride(
        mediaType: MediaType,
        tmdbId: Int?,
        fallbackKey: String,
        seasonNumber: Int? = null,
        episodeNumber: Int? = null,
        streamUrl: String,
        subtitleUrl: String,
        qualityLabel: String = "Manual"
    ) = withContext(Dispatchers.IO) {
        val key = SourceMatcher.buildMediaKey(mediaType, tmdbId, fallbackKey, seasonNumber, episodeNumber)
        mediaLinkOverrideDao.upsert(
            MediaLinkOverrideEntity(
                mediaKey = key,
                tmdbId = tmdbId,
                mediaType = mediaType.name,
                seasonNumber = seasonNumber,
                episodeNumber = episodeNumber,
                streamUrl = streamUrl.trim(),
                subtitleUrl = subtitleUrl.trim(),
                qualityLabel = qualityLabel.ifBlank { "Manual" }
            )
        )
    }

    suspend fun fetchTextFromUrlOrUri(location: String): String = withContext(Dispatchers.IO) {
        if (location.startsWith("content://") || location.startsWith("file://")) {
            val uri = Uri.parse(location)
            context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                ?: error("Unable to read selected file")
        } else {
            val request = Request.Builder().url(location).build()
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    error("HTTP ${response.code}: ${response.message}")
                }
                response.body?.string().orEmpty()
            }
        }
    }
}
