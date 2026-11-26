package com.aluqabi.cinema.domain.model

import kotlinx.serialization.Serializable

enum class MediaType {
    MOVIE,
    SERIES,
    LIVE_TV
}

enum class SourceType {
    M3U_PLAYLIST,
    JSON_CATALOG,
    DIRECT_STREAM
}

@Serializable
data class StreamQualityOption(
    val label: String,
    val url: String
)

@Serializable
data class SubtitleTrackOption(
    val label: String,
    val language: String = "ar",
    val url: String
)

@Serializable
data class CatalogEpisodePayload(
    val episodeNumber: Int,
    val title: String = "",
    val overview: String = "",
    val stillUrl: String = "",
    val streamUrl: String = "",
    val qualities: List<StreamQualityOption> = emptyList(),
    val subtitles: List<SubtitleTrackOption> = emptyList()
)

@Serializable
data class CatalogSeasonPayload(
    val seasonNumber: Int,
    val episodes: List<CatalogEpisodePayload> = emptyList()
)

@Serializable
data class CatalogItemPayload(
    val streamUrl: String = "",
    val qualities: List<StreamQualityOption> = emptyList(),
    val subtitles: List<SubtitleTrackOption> = emptyList(),
    val seasons: List<CatalogSeasonPayload> = emptyList()
)

data class MediaCardItem(
    val mediaKey: String,
    val mediaType: MediaType,
    val title: String,
    val originalTitle: String = "",
    val overview: String = "",
    val posterUrl: String = "",
    val backdropUrl: String = "",
    val year: String = "",
    val rating: Double = 0.0,
    val tmdbId: Int? = null,
    val genres: List<String> = emptyList(),
    val directStreamUrl: String = ""
)

data class SeasonSummary(
    val seasonNumber: Int,
    val name: String,
    val episodeCount: Int,
    val posterUrl: String = ""
)

data class EpisodeItem(
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String,
    val overview: String = "",
    val stillUrl: String = "",
    val runtimeMinutes: Int? = null,
    val rating: Double = 0.0,
    val resolvedStreams: List<StreamQualityOption> = emptyList(),
    val resolvedSubtitles: List<SubtitleTrackOption> = emptyList()
)

data class ResolvedPlayback(
    val streams: List<StreamQualityOption> = emptyList(),
    val subtitles: List<SubtitleTrackOption> = emptyList(),
    val sourceLabel: String? = null
) {
    val primaryUrl: String?
        get() = streams.firstOrNull { it.url.isNotBlank() }?.url
}

data class LiveChannelItem(
    val id: Long,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val streamUrl: String,
    val tvgId: String = ""
)

data class PlayerEpisodeEntry(
    val seasonNumber: Int,
    val episodeNumber: Int,
    val title: String,
    val streamUrl: String,
    val qualities: List<StreamQualityOption> = emptyList(),
    val subtitles: List<SubtitleTrackOption> = emptyList()
)

data class PlayerLaunchRequest(
    val mediaKey: String,
    val mediaType: MediaType,
    val title: String,
    val subtitle: String = "",
    val posterUrl: String = "",
    val tmdbId: Int? = null,
    val streamOptions: List<StreamQualityOption>,
    val externalSubtitles: List<SubtitleTrackOption> = emptyList(),
    val initialPositionMs: Long = 0L,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val episodesQueue: List<PlayerEpisodeEntry> = emptyList()
)
