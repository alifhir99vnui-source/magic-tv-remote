package com.aluqabi.cinema.ui.player

import androidx.media3.common.TrackGroup

enum class PlayerAspectMode {
    FIT,
    FILL,
    ZOOM,
    STRETCH;

    fun next(): PlayerAspectMode = entries[(ordinal + 1) % entries.size]
}

enum class PlayerSheet {
    NONE,
    QUALITY_AUDIO,
    SUBTITLES,
    SPEED,
    EPISODES
}

data class VideoQualityTrack(
    val id: String,
    val label: String,
    val height: Int,
    val bitrate: Int,
    val isSelected: Boolean,
    val trackGroup: TrackGroup? = null,
    val trackIndex: Int = -1,
    val externalUrl: String? = null
)

data class AudioTrackItem(
    val id: String,
    val label: String,
    val language: String,
    val isSelected: Boolean,
    val trackGroup: TrackGroup,
    val trackIndex: Int
)

data class EmbeddedSubtitleTrack(
    val id: String,
    val label: String,
    val language: String,
    val isSelected: Boolean,
    val trackGroup: TrackGroup,
    val trackIndex: Int
)

enum class EdgeHudType {
    BRIGHTNESS,
    VOLUME
}
