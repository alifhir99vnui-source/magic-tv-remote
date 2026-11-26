package com.aluqabi.cinema.data.source

import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.CachedChannelEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.SubtitleTrackOption

/**
 * Resolves playable stream URLs and subtitle tracks for any TMDB movie or episode
 * by checking user manual overrides, JSON catalog sources, and M3U VOD entries.
 */
object SourceMatcher {

    fun normalizeTitle(raw: String): String {
        return raw.lowercase()
            .replace(Regex("""[^\p{L}\p{N}\s]"""), " ")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }

    fun buildMediaKey(
        mediaType: MediaType,
        tmdbId: Int?,
        fallbackId: String,
        seasonNumber: Int? = null,
        episodeNumber: Int? = null
    ): String {
        val base = when {
            tmdbId != null -> "${mediaType.name.lowercase()}_$tmdbId"
            else -> "${mediaType.name.lowercase()}_${fallbackId.hashCode()}"
        }
        return if (seasonNumber != null && episodeNumber != null) {
            "${base}_s${seasonNumber}_e${episodeNumber}"
        } else {
            base
        }
    }

    fun resolve(
        mediaType: MediaType,
        tmdbId: Int?,
        title: String,
        originalTitle: String,
        seasonNumber: Int? = null,
        episodeNumber: Int? = null,
        overrideEntity: MediaLinkOverrideEntity?,
        catalogItems: List<CachedCatalogItemEntity>,
        m3uEntries: List<CachedChannelEntity>
    ): ResolvedPlayback {
        // 1. User manual link override always takes precedence
        if (overrideEntity != null && overrideEntity.streamUrl.isNotBlank()) {
            val subs = if (overrideEntity.subtitleUrl.isNotBlank()) {
                listOf(
                    SubtitleTrackOption(
                        label = "External Subtitle",
                        language = "ar",
                        url = overrideEntity.subtitleUrl
                    )
                )
            } else {
                emptyList()
            }
            return ResolvedPlayback(
                streams = listOf(
                    StreamQualityOption(
                        label = overrideEntity.qualityLabel.ifBlank { "Manual" },
                        url = overrideEntity.streamUrl
                    )
                ),
                subtitles = subs,
                sourceLabel = "Manual Link"
            )
        }

        val normalizedCandidates = listOf(title, originalTitle)
            .map { normalizeTitle(it) }
            .filter { it.isNotBlank() }
            .distinct()

        // 2. Match against JSON catalog items by TMDB ID first, then normalized title
        val matchedCatalog = catalogItems.firstOrNull { item ->
            item.mediaType.equals(mediaType.name, ignoreCase = true) &&
                tmdbId != null && item.tmdbId == tmdbId
        } ?: catalogItems.firstOrNull { item ->
            if (!item.mediaType.equals(mediaType.name, ignoreCase = true)) return@firstOrNull false
            val itemNames = listOf(item.title, item.titleAr, item.originalTitle)
                .map { normalizeTitle(it) }
                .filter { it.isNotBlank() }
            normalizedCandidates.any { cand -> itemNames.any { it == cand || it.contains(cand) || cand.contains(it) } }
        }

        if (matchedCatalog != null) {
            val payload = JsonCatalogParser.decodePayload(matchedCatalog.payloadJson)
            if (mediaType == MediaType.MOVIE) {
                val streams = payload.qualities.ifEmpty {
                    if (payload.streamUrl.isNotBlank()) {
                        listOf(StreamQualityOption("Auto", payload.streamUrl))
                    } else {
                        emptyList()
                    }
                }
                if (streams.isNotEmpty()) {
                    return ResolvedPlayback(
                        streams = streams,
                        subtitles = payload.subtitles,
                        sourceLabel = "JSON Source"
                    )
                }
            } else if (mediaType == MediaType.SERIES && seasonNumber != null && episodeNumber != null) {
                val episodePayload = payload.seasons
                    .firstOrNull { it.seasonNumber == seasonNumber }
                    ?.episodes
                    ?.firstOrNull { it.episodeNumber == episodeNumber }
                if (episodePayload != null) {
                    val streams = episodePayload.qualities.ifEmpty {
                        if (episodePayload.streamUrl.isNotBlank()) {
                            listOf(StreamQualityOption("Auto", episodePayload.streamUrl))
                        } else {
                            emptyList()
                        }
                    }
                    if (streams.isNotEmpty()) {
                        return ResolvedPlayback(
                            streams = streams,
                            subtitles = episodePayload.subtitles.ifEmpty { payload.subtitles },
                            sourceLabel = "JSON Source"
                        )
                    }
                }
            }
        }

        // 3. Fallback search inside M3U entries (useful for VOD M3U playlists)
        if (normalizedCandidates.isNotEmpty()) {
            val epTag = if (seasonNumber != null && episodeNumber != null) {
                "s%02de%02d".format(seasonNumber, episodeNumber)
            } else {
                null
            }
            val matchedM3u = m3uEntries.firstOrNull { entry ->
                val normEntry = normalizeTitle(entry.name)
                val titleMatch = normalizedCandidates.any { cand ->
                    normEntry == cand || normEntry.contains(cand)
                }
                if (!titleMatch) return@firstOrNull false
                if (epTag != null) {
                    entry.name.lowercase().contains(epTag) ||
                        normEntry.contains("s$seasonNumber e$episodeNumber")
                } else {
                    true
                }
            }
            if (matchedM3u != null) {
                return ResolvedPlayback(
                    streams = listOf(StreamQualityOption("M3U", matchedM3u.streamUrl)),
                    subtitles = emptyList(),
                    sourceLabel = matchedM3u.groupTitle
                )
            }
        }

        return ResolvedPlayback()
    }
}
