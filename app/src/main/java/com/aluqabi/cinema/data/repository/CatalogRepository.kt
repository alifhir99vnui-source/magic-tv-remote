package com.aluqabi.cinema.data.repository

import com.aluqabi.cinema.data.local.dao.CachedCatalogDao
import com.aluqabi.cinema.data.local.dao.FavoriteDao
import com.aluqabi.cinema.data.local.dao.WatchHistoryDao
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.data.remote.TmdbApiService
import com.aluqabi.cinema.data.remote.model.TmdbGenreDto
import com.aluqabi.cinema.data.remote.model.TmdbImageUrl
import com.aluqabi.cinema.data.remote.model.TmdbMediaDto
import com.aluqabi.cinema.data.source.JsonCatalogParser
import com.aluqabi.cinema.data.source.SourceMatcher
import com.aluqabi.cinema.domain.model.EpisodeItem
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.SeasonSummary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

data class MovieDetailBundle(
    val card: MediaCardItem,
    val runtimeMinutes: Int? = null,
    val genres: List<String> = emptyList()
)

data class SeriesDetailBundle(
    val card: MediaCardItem,
    val genres: List<String> = emptyList(),
    val seasons: List<SeasonSummary> = emptyList()
)

/**
 * Coordinates TMDB metadata fetching, custom JSON catalog merging, favorites, and watch history.
 */
class CatalogRepository(
    private val tmdbApi: TmdbApiService,
    private val cachedCatalogDao: CachedCatalogDao,
    private val favoriteDao: FavoriteDao,
    private val watchHistoryDao: WatchHistoryDao,
    private val sourcesRepository: SourcesRepository
) {
    private fun authPair(rawKey: String): Pair<String?, String?> {
        val trimmed = rawKey.trim()
        return if (trimmed.length > 40) {
            null to "Bearer $trimmed"
        } else {
            trimmed to null
        }
    }

    private fun tmdbLang(languageCode: String): String =
        if (languageCode == "ar") "ar-IQ" else "en-US"

    suspend fun testTmdbConnection(apiKey: String, languageCode: String): Result<Int> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                val res = tmdbApi.getTrendingAll(key, bearer, tmdbLang(languageCode), 1)
                res.results.size
            }
        }

    suspend fun fetchTrending(apiKey: String, languageCode: String): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                val res = tmdbApi.getTrendingAll(key, bearer, tmdbLang(languageCode))
                res.results.mapNotNull { it.toCardItem() }
            }
        }

    suspend fun fetchPopularMovies(apiKey: String, languageCode: String, genreId: Int? = null): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                val res = if (genreId == null) {
                    tmdbApi.getPopularMovies(key, bearer, tmdbLang(languageCode))
                } else {
                    tmdbApi.discoverMovies(key, bearer, tmdbLang(languageCode), genreId)
                }
                res.results.mapNotNull { it.toCardItem(MediaType.MOVIE) }
            }
        }

    suspend fun fetchTopRatedMovies(apiKey: String, languageCode: String): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getTopRatedMovies(key, bearer, tmdbLang(languageCode))
                    .results.mapNotNull { it.toCardItem(MediaType.MOVIE) }
            }
        }

    suspend fun fetchMovieGenres(apiKey: String, languageCode: String): List<TmdbGenreDto> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getMovieGenres(key, bearer, tmdbLang(languageCode)).genres
            }.getOrDefault(emptyList())
        }

    suspend fun fetchPopularSeries(apiKey: String, languageCode: String, genreId: Int? = null): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                val res = if (genreId == null) {
                    tmdbApi.getPopularSeries(key, bearer, tmdbLang(languageCode))
                } else {
                    tmdbApi.discoverSeries(key, bearer, tmdbLang(languageCode), genreId)
                }
                res.results.mapNotNull { it.toCardItem(MediaType.SERIES) }
            }
        }

    suspend fun fetchTopRatedSeries(apiKey: String, languageCode: String): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getTopRatedSeries(key, bearer, tmdbLang(languageCode))
                    .results.mapNotNull { it.toCardItem(MediaType.SERIES) }
            }
        }

    suspend fun fetchSeriesGenres(apiKey: String, languageCode: String): List<TmdbGenreDto> =
        withContext(Dispatchers.IO) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getSeriesGenres(key, bearer, tmdbLang(languageCode)).genres
            }.getOrDefault(emptyList())
        }

    suspend fun searchCatalog(
        apiKey: String,
        languageCode: String,
        query: String
    ): List<MediaCardItem> = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) return@withContext emptyList()
        val localMatches = cachedCatalogDao.getActiveItems()
            .filter {
                it.title.contains(cleanQuery, ignoreCase = true) ||
                    it.titleAr.contains(cleanQuery, ignoreCase = true) ||
                    it.originalTitle.contains(cleanQuery, ignoreCase = true)
            }
            .map { it.toMediaCardItem() }

        val tmdbMatches = if (apiKey.isNotBlank()) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.searchMulti(key, bearer, cleanQuery, tmdbLang(languageCode))
                    .results.mapNotNull { it.toCardItem() }
            }.getOrDefault(emptyList())
        } else {
            emptyList()
        }

        (tmdbMatches + localMatches).distinctBy { it.mediaKey }
    }

    suspend fun getMovieDetails(
        apiKey: String,
        languageCode: String,
        tmdbId: Int?,
        fallbackCard: MediaCardItem?
    ): MovieDetailBundle = withContext(Dispatchers.IO) {
        if (tmdbId != null && apiKey.isNotBlank()) {
            val remote = runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getMovieDetails(tmdbId, key, bearer, tmdbLang(languageCode))
            }.getOrNull()
            if (remote != null) {
                val card = MediaCardItem(
                    mediaKey = SourceMatcher.buildMediaKey(MediaType.MOVIE, remote.id, remote.title),
                    mediaType = MediaType.MOVIE,
                    title = remote.title,
                    originalTitle = remote.originalTitle.orEmpty(),
                    overview = remote.overview.orEmpty(),
                    posterUrl = TmdbImageUrl.poster(remote.posterPath),
                    backdropUrl = TmdbImageUrl.backdrop(remote.backdropPath),
                    year = remote.releaseDate?.take(4).orEmpty(),
                    rating = remote.voteAverage,
                    tmdbId = remote.id,
                    genres = remote.genres.map { it.name }
                )
                return@withContext MovieDetailBundle(
                    card = card,
                    runtimeMinutes = remote.runtime,
                    genres = remote.genres.map { it.name }
                )
            }
        }
        val card = fallbackCard ?: MediaCardItem(
            mediaKey = "movie_${tmdbId ?: 0}",
            mediaType = MediaType.MOVIE,
            title = "Movie",
            tmdbId = tmdbId
        )
        MovieDetailBundle(card = card, genres = card.genres)
    }

    suspend fun getSeriesDetails(
        apiKey: String,
        languageCode: String,
        tmdbId: Int?,
        fallbackCard: MediaCardItem?
    ): SeriesDetailBundle = withContext(Dispatchers.IO) {
        if (tmdbId != null && apiKey.isNotBlank()) {
            val remote = runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getSeriesDetails(tmdbId, key, bearer, tmdbLang(languageCode))
            }.getOrNull()
            if (remote != null) {
                val card = MediaCardItem(
                    mediaKey = SourceMatcher.buildMediaKey(MediaType.SERIES, remote.id, remote.name),
                    mediaType = MediaType.SERIES,
                    title = remote.name,
                    originalTitle = remote.originalName.orEmpty(),
                    overview = remote.overview.orEmpty(),
                    posterUrl = TmdbImageUrl.poster(remote.posterPath),
                    backdropUrl = TmdbImageUrl.backdrop(remote.backdropPath),
                    year = remote.firstAirDate?.take(4).orEmpty(),
                    rating = remote.voteAverage,
                    tmdbId = remote.id,
                    genres = remote.genres.map { it.name }
                )
                val seasons = remote.seasons
                    .filter { it.seasonNumber > 0 }
                    .map {
                        SeasonSummary(
                            seasonNumber = it.seasonNumber,
                            name = it.name,
                            episodeCount = it.episodeCount,
                            posterUrl = TmdbImageUrl.poster(it.posterPath)
                        )
                    }
                return@withContext SeriesDetailBundle(
                    card = card,
                    genres = remote.genres.map { it.name },
                    seasons = seasons
                )
            }
        }

        // Check custom JSON catalog seasons if TMDB is unavailable
        val localItem = cachedCatalogDao.getActiveItems().firstOrNull {
            it.mediaType == MediaType.SERIES.name &&
                ((tmdbId != null && it.tmdbId == tmdbId) ||
                    (fallbackCard != null && it.title.equals(fallbackCard.title, ignoreCase = true)))
        }
        val localSeasons = if (localItem != null) {
            JsonCatalogParser.decodePayload(localItem.payloadJson).seasons.map {
                SeasonSummary(
                    seasonNumber = it.seasonNumber,
                    name = "Season ${it.seasonNumber}",
                    episodeCount = it.episodes.size
                )
            }
        } else {
            listOf(SeasonSummary(seasonNumber = 1, name = "Season 1", episodeCount = 0))
        }

        val card = fallbackCard ?: localItem?.toMediaCardItem() ?: MediaCardItem(
            mediaKey = "series_${tmdbId ?: 0}",
            mediaType = MediaType.SERIES,
            title = "Series",
            tmdbId = tmdbId
        )
        SeriesDetailBundle(card = card, genres = card.genres, seasons = localSeasons)
    }

    suspend fun getSeasonEpisodes(
        apiKey: String,
        languageCode: String,
        seriesCard: MediaCardItem,
        seasonNumber: Int
    ): List<EpisodeItem> = withContext(Dispatchers.IO) {
        val remoteEpisodes = if (seriesCard.tmdbId != null && apiKey.isNotBlank()) {
            runCatching {
                val (key, bearer) = authPair(apiKey)
                tmdbApi.getSeasonDetails(seriesCard.tmdbId, seasonNumber, key, bearer, tmdbLang(languageCode))
                    .episodes
            }.getOrDefault(emptyList())
        } else {
            emptyList()
        }

        if (remoteEpisodes.isNotEmpty()) {
            return@withContext remoteEpisodes.map { ep ->
                val resolved = sourcesRepository.resolvePlayback(
                    mediaType = MediaType.SERIES,
                    tmdbId = seriesCard.tmdbId,
                    title = seriesCard.title,
                    originalTitle = seriesCard.originalTitle,
                    seasonNumber = seasonNumber,
                    episodeNumber = ep.episodeNumber,
                    fallbackKey = seriesCard.mediaKey
                )
                EpisodeItem(
                    seasonNumber = seasonNumber,
                    episodeNumber = ep.episodeNumber,
                    title = ep.name.ifBlank { "Episode ${ep.episodeNumber}" },
                    overview = ep.overview.orEmpty(),
                    stillUrl = TmdbImageUrl.poster(ep.stillPath),
                    runtimeMinutes = ep.runtime,
                    rating = ep.voteAverage,
                    resolvedStreams = resolved.streams,
                    resolvedSubtitles = resolved.subtitles
                )
            }
        }

        // Local JSON catalog fallback episodes
        val localItem = cachedCatalogDao.getActiveItems().firstOrNull {
            it.mediaType == MediaType.SERIES.name &&
                ((seriesCard.tmdbId != null && it.tmdbId == seriesCard.tmdbId) ||
                    it.title.equals(seriesCard.title, ignoreCase = true))
        } ?: return@withContext emptyList()

        val payload = JsonCatalogParser.decodePayload(localItem.payloadJson)
        val season = payload.seasons.firstOrNull { it.seasonNumber == seasonNumber } ?: return@withContext emptyList()
        season.episodes.map { ep ->
            val resolved = sourcesRepository.resolvePlayback(
                mediaType = MediaType.SERIES,
                tmdbId = seriesCard.tmdbId,
                title = seriesCard.title,
                originalTitle = seriesCard.originalTitle,
                seasonNumber = seasonNumber,
                episodeNumber = ep.episodeNumber,
                fallbackKey = seriesCard.mediaKey
            )
            EpisodeItem(
                seasonNumber = seasonNumber,
                episodeNumber = ep.episodeNumber,
                title = ep.title.ifBlank { "Episode ${ep.episodeNumber}" },
                overview = ep.overview,
                stillUrl = ep.stillUrl,
                resolvedStreams = resolved.streams,
                resolvedSubtitles = resolved.subtitles
            )
        }
    }

    fun observeFavorites(userId: Long): Flow<List<FavoriteEntity>> = favoriteDao.observeForUser(userId)

    fun observeIsFavorite(userId: Long, mediaKey: String): Flow<Boolean> =
        favoriteDao.observeIsFavorite("${userId}_$mediaKey")

    suspend fun toggleFavorite(userId: Long, card: MediaCardItem, currentlyFavorite: Boolean) {
        val recordKey = "${userId}_${card.mediaKey}"
        if (currentlyFavorite) {
            favoriteDao.deleteByKey(recordKey)
        } else {
            favoriteDao.upsert(
                FavoriteEntity(
                    recordKey = recordKey,
                    mediaKey = card.mediaKey,
                    userId = userId,
                    mediaType = card.mediaType.name,
                    title = card.title,
                    posterUrl = card.posterUrl,
                    backdropUrl = card.backdropUrl,
                    streamUrl = card.directStreamUrl,
                    tmdbId = card.tmdbId,
                    rating = card.rating,
                    year = card.year
                )
            )
        }
    }

    fun observeWatchHistory(userId: Long): Flow<List<WatchHistoryEntity>> =
        watchHistoryDao.observeForUser(userId)

    suspend fun getWatchProgress(userId: Long, mediaKey: String): WatchHistoryEntity? =
        watchHistoryDao.getByKey("${userId}_$mediaKey")

    suspend fun saveWatchProgress(
        userId: Long,
        mediaKey: String,
        mediaType: MediaType,
        title: String,
        subtitle: String,
        posterUrl: String,
        streamUrl: String,
        tmdbId: Int?,
        seasonNumber: Int?,
        episodeNumber: Int?,
        positionMs: Long,
        durationMs: Long
    ) {
        watchHistoryDao.upsert(
            WatchHistoryEntity(
                recordKey = "${userId}_$mediaKey",
                mediaKey = mediaKey,
                userId = userId,
                mediaType = mediaType.name,
                title = title,
                subtitle = subtitle,
                posterUrl = posterUrl,
                streamUrl = streamUrl,
                tmdbId = tmdbId,
                seasonNumber = seasonNumber,
                episodeNumber = episodeNumber,
                positionMs = positionMs.coerceAtLeast(0L),
                durationMs = durationMs.coerceAtLeast(0L),
                updatedAt = System.currentTimeMillis()
            )
        )
    }

    suspend fun clearWatchHistory(userId: Long) = watchHistoryDao.clearForUser(userId)

    private fun TmdbMediaDto.toCardItem(forcedType: MediaType? = null): MediaCardItem? {
        val type = forcedType ?: when (mediaType?.lowercase()) {
            "movie" -> MediaType.MOVIE
            "tv" -> MediaType.SERIES
            else -> return null
        }
        val displayTitle = (title ?: name).orEmpty()
        if (displayTitle.isBlank()) return null
        return MediaCardItem(
            mediaKey = SourceMatcher.buildMediaKey(type, id, displayTitle),
            mediaType = type,
            title = displayTitle,
            originalTitle = (originalTitle ?: originalName).orEmpty(),
            overview = overview.orEmpty(),
            posterUrl = TmdbImageUrl.poster(posterPath),
            backdropUrl = TmdbImageUrl.backdrop(backdropPath),
            year = (releaseDate ?: firstAirDate)?.take(4).orEmpty(),
            rating = voteAverage,
            tmdbId = id
        )
    }

    fun CachedCatalogItemEntity.toMediaCardItem(): MediaCardItem {
        val type = if (mediaType.equals(MediaType.SERIES.name, ignoreCase = true)) {
            MediaType.SERIES
        } else {
            MediaType.MOVIE
        }
        val payload = JsonCatalogParser.decodePayload(payloadJson)
        val primaryUrl = payload.qualities.firstOrNull()?.url ?: payload.streamUrl
        return MediaCardItem(
            mediaKey = SourceMatcher.buildMediaKey(type, tmdbId, title),
            mediaType = type,
            title = titleAr.ifBlank { title },
            originalTitle = originalTitle.ifBlank { title },
            overview = overview,
            posterUrl = posterUrl,
            backdropUrl = backdropUrl.ifBlank { posterUrl },
            year = year,
            rating = rating,
            tmdbId = tmdbId,
            genres = genres.split(",").map { it.trim() }.filter { it.isNotEmpty() },
            directStreamUrl = primaryUrl
        )
    }
}
