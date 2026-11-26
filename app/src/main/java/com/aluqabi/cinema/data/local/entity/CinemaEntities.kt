package com.aluqabi.cinema.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val passwordHash: String = "",
    val passwordSalt: String = "",
    val authProvider: String = "EMAIL",
    val avatarColorHex: Long = 0xFFE50914L,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "sources")
data class SourceEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val name: String,
    val type: String, // M3U_PLAYLIST, JSON_CATALOG, DIRECT_STREAM
    val url: String,
    val isEnabled: Boolean = true,
    val itemCount: Int = 0,
    val lastSyncedAt: Long = 0L,
    val lastError: String? = null
)

@Entity(tableName = "favorites")
data class FavoriteEntity(
    @PrimaryKey
    val recordKey: String, // "${userId}_${mediaKey}"
    val mediaKey: String,
    val userId: Long,
    val mediaType: String, // MOVIE, SERIES, LIVE_TV
    val title: String,
    val posterUrl: String = "",
    val backdropUrl: String = "",
    val streamUrl: String = "",
    val tmdbId: Int? = null,
    val rating: Double = 0.0,
    val year: String = "",
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "watch_history")
data class WatchHistoryEntity(
    @PrimaryKey
    val recordKey: String, // "${userId}_${mediaKey}"
    val mediaKey: String,
    val userId: Long,
    val mediaType: String, // MOVIE, SERIES, LIVE_TV
    val title: String,
    val subtitle: String = "",
    val posterUrl: String = "",
    val streamUrl: String,
    val tmdbId: Int? = null,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "media_link_overrides")
data class MediaLinkOverrideEntity(
    @PrimaryKey
    val mediaKey: String,
    val tmdbId: Int? = null,
    val mediaType: String,
    val seasonNumber: Int? = null,
    val episodeNumber: Int? = null,
    val streamUrl: String,
    val subtitleUrl: String = "",
    val qualityLabel: String = "Auto",
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "cached_channels")
data class CachedChannelEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sourceId: Long,
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val streamUrl: String,
    val tvgId: String = ""
)

@Entity(tableName = "cached_catalog_items")
data class CachedCatalogItemEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val sourceId: Long,
    val tmdbId: Int? = null,
    val mediaType: String, // MOVIE, SERIES
    val title: String,
    val titleAr: String = "",
    val originalTitle: String = "",
    val overview: String = "",
    val posterUrl: String = "",
    val backdropUrl: String = "",
    val year: String = "",
    val rating: Double = 0.0,
    val genres: String = "",
    val payloadJson: String
)
