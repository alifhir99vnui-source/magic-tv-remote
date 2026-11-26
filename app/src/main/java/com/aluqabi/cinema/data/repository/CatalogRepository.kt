package com.aluqabi.cinema.data.repository

import com.aluqabi.cinema.config.AppConfig
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.dao.CachedCatalogDao
import com.aluqabi.cinema.data.local.dao.FavoriteDao
import com.aluqabi.cinema.data.local.dao.WatchHistoryDao
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.data.remote.SupabaseClient
import com.aluqabi.cinema.data.remote.TmdbApiService
import com.aluqabi.cinema.data.remote.asArrOrEmpty
import com.aluqabi.cinema.data.remote.asObjOrNull
import com.aluqabi.cinema.data.remote.double
import com.aluqabi.cinema.data.remote.intOrNull
import com.aluqabi.cinema.data.remote.long
import com.aluqabi.cinema.data.remote.str
import com.aluqabi.cinema.data.remote.model.TmdbGenreDto
import com.aluqabi.cinema.data.remote.model.TmdbImageUrl
import com.aluqabi.cinema.data.remote.model.TmdbMediaDto
import com.aluqabi.cinema.data.source.JsonCatalogParser
import com.aluqabi.cinema.data.source.SourceMatcher
import com.aluqabi.cinema.domain.model.CommentItem
import com.aluqabi.cinema.domain.model.EpisodeItem
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.ReactionState
import com.aluqabi.cinema.domain.model.SeasonSummary
import com.aluqabi.cinema.domain.model.UserRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

data class MovieDetailBundle(val card: MediaCardItem, val runtimeMinutes: Int? = null, val genres: List<String> = emptyList())
data class SeriesDetailBundle(val card: MediaCardItem, val genres: List<String> = emptyList(), val seasons: List<SeasonSummary> = emptyList())

class CatalogRepository(
    private val tmdbApi: TmdbApiService,
    private val supabase: SupabaseClient,
    private val settingsDataStore: SettingsDataStore,
    private val cachedCatalogDao: CachedCatalogDao,
    private val favoriteDao: FavoriteDao,
    private val watchHistoryDao: WatchHistoryDao,
    private val sourcesRepository: SourcesRepository
) {
    private fun authPair(rawKey: String): Pair<String?, String?> {
        val trimmed = rawKey.trim()
        return if (trimmed.length > 40) null to "Bearer $trimmed" else trimmed to null
    }

    private fun tmdbLang(languageCode: String): String = if (languageCode == "ar") "ar-IQ" else "en-US"
    private fun tmdbKey(): String = AppConfig.TMDB_API_KEY

    suspend fun testTmdbConnection(apiKey: String = tmdbKey(), languageCode: String = "ar"): Result<Int> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getTrendingAll(k, b, tmdbLang(languageCode), 1).results.size } }

    suspend fun fetchTrending(apiKey: String = tmdbKey(), languageCode: String = "ar"): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getTrendingAll(k, b, tmdbLang(languageCode)).results.mapNotNull { it.toCardItem() } } }

    suspend fun fetchPopularMovies(apiKey: String = tmdbKey(), languageCode: String = "ar", genreId: Int? = null): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) { runCatching {
            val (k, b) = authPair(apiKey)
            val res = if (genreId == null) tmdbApi.getPopularMovies(k, b, tmdbLang(languageCode)) else tmdbApi.discoverMovies(k, b, tmdbLang(languageCode), genreId)
            res.results.mapNotNull { it.toCardItem(MediaType.MOVIE) }
        } }

    suspend fun fetchTopRatedMovies(apiKey: String = tmdbKey(), languageCode: String = "ar"): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getTopRatedMovies(k, b, tmdbLang(languageCode)).results.mapNotNull { it.toCardItem(MediaType.MOVIE) } } }

    suspend fun fetchMovieGenres(apiKey: String = tmdbKey(), languageCode: String = "ar"): List<TmdbGenreDto> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getMovieGenres(k, b, tmdbLang(languageCode)).genres }.getOrDefault(emptyList()) }

    suspend fun fetchPopularSeries(apiKey: String = tmdbKey(), languageCode: String = "ar", genreId: Int? = null): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) { runCatching {
            val (k, b) = authPair(apiKey)
            val res = if (genreId == null) tmdbApi.getPopularSeries(k, b, tmdbLang(languageCode)) else tmdbApi.discoverSeries(k, b, tmdbLang(languageCode), genreId)
            res.results.mapNotNull { it.toCardItem(MediaType.SERIES) }
        } }

    suspend fun fetchTopRatedSeries(apiKey: String = tmdbKey(), languageCode: String = "ar"): Result<List<MediaCardItem>> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getTopRatedSeries(k, b, tmdbLang(languageCode)).results.mapNotNull { it.toCardItem(MediaType.SERIES) } } }

    suspend fun fetchSeriesGenres(apiKey: String = tmdbKey(), languageCode: String = "ar"): List<TmdbGenreDto> =
        withContext(Dispatchers.IO) { runCatching { val (k, b) = authPair(apiKey); tmdbApi.getSeriesGenres(k, b, tmdbLang(languageCode)).genres }.getOrDefault(emptyList()) }

    suspend fun searchCatalog(apiKey: String = tmdbKey(), languageCode: String = "ar", query: String): List<MediaCardItem> = withContext(Dispatchers.IO) {
        val clean = query.trim(); if (clean.isBlank()) return@withContext emptyList()
        val local = cachedCatalogDao.getActiveItems().filter { it.title.contains(clean, true) || it.titleAr.contains(clean, true) || it.originalTitle.contains(clean, true) }.map { it.toMediaCardItem() }
        val tmdb = if (apiKey.isNotBlank()) runCatching { val (k, b) = authPair(apiKey); tmdbApi.searchMulti(k, b, clean, tmdbLang(languageCode)).results.mapNotNull { it.toCardItem() } }.getOrDefault(emptyList()) else emptyList()
        (tmdb + local).distinctBy { it.mediaKey }
    }

    suspend fun getMovieDetails(apiKey: String = tmdbKey(), languageCode: String = "ar", tmdbId: Int?, fallbackCard: MediaCardItem?): MovieDetailBundle = withContext(Dispatchers.IO) {
        if (tmdbId != null && apiKey.isNotBlank()) {
            val remote = runCatching { val (k, b) = authPair(apiKey); tmdbApi.getMovieDetails(tmdbId, k, b, tmdbLang(languageCode)) }.getOrNull()
            if (remote != null) {
                val card = MediaCardItem(SourceMatcher.buildMediaKey(MediaType.MOVIE, remote.id, remote.title), MediaType.MOVIE, remote.title, remote.originalTitle.orEmpty(), remote.overview.orEmpty(), TmdbImageUrl.poster(remote.posterPath), TmdbImageUrl.backdrop(remote.backdropPath), remote.releaseDate?.take(4).orEmpty(), remote.voteAverage, remote.id, remote.genres.map { it.name })
                return@withContext MovieDetailBundle(card, remote.runtime, remote.genres.map { it.name })
            }
        }
        MovieDetailBundle(fallbackCard ?: MediaCardItem("movie_${tmdbId ?: 0}", MediaType.MOVIE, "Movie", tmdbId = tmdbId), genres = fallbackCard?.genres.orEmpty())
    }

    suspend fun getSeriesDetails(apiKey: String = tmdbKey(), languageCode: String = "ar", tmdbId: Int?, fallbackCard: MediaCardItem?): SeriesDetailBundle = withContext(Dispatchers.IO) {
        if (tmdbId != null && apiKey.isNotBlank()) {
            val remote = runCatching { val (k, b) = authPair(apiKey); tmdbApi.getSeriesDetails(tmdbId, k, b, tmdbLang(languageCode)) }.getOrNull()
            if (remote != null) {
                val card = MediaCardItem(SourceMatcher.buildMediaKey(MediaType.SERIES, remote.id, remote.name), MediaType.SERIES, remote.name, remote.originalName.orEmpty(), remote.overview.orEmpty(), TmdbImageUrl.poster(remote.posterPath), TmdbImageUrl.backdrop(remote.backdropPath), remote.firstAirDate?.take(4).orEmpty(), remote.voteAverage, remote.id, remote.genres.map { it.name })
                val seasons = remote.seasons.filter { it.seasonNumber > 0 }.map { SeasonSummary(it.seasonNumber, it.name, it.episodeCount, TmdbImageUrl.poster(it.posterPath)) }
                return@withContext SeriesDetailBundle(card, remote.genres.map { it.name }, seasons)
            }
        }
        val local = cachedCatalogDao.getActiveItems().firstOrNull { it.mediaType == "SERIES" && ((tmdbId != null && it.tmdbId == tmdbId) || (fallbackCard != null && it.title.equals(fallbackCard.title, true))) }
        val localSeasons = local?.let { JsonCatalogParser.decodePayload(it.payloadJson).seasons.map { s -> SeasonSummary(s.seasonNumber, "Season ${s.seasonNumber}", s.episodes.size) } } ?: listOf(SeasonSummary(1, "Season 1", 0))
        SeriesDetailBundle(fallbackCard ?: local?.toMediaCardItem() ?: MediaCardItem("series_${tmdbId ?: 0}", MediaType.SERIES, "Series", tmdbId = tmdbId), fallbackCard?.genres.orEmpty(), localSeasons)
    }

    suspend fun getSeasonEpisodes(apiKey: String = tmdbKey(), languageCode: String = "ar", seriesCard: MediaCardItem, seasonNumber: Int): List<EpisodeItem> = withContext(Dispatchers.IO) {
        val remote = if (seriesCard.tmdbId != null && apiKey.isNotBlank()) runCatching { val (k, b) = authPair(apiKey); tmdbApi.getSeasonDetails(seriesCard.tmdbId, seasonNumber, k, b, tmdbLang(languageCode)).episodes }.getOrDefault(emptyList()) else emptyList()
        if (remote.isNotEmpty()) {
            return@withContext remote.map { ep ->
                val resolved = sourcesRepository.resolvePlayback(MediaType.SERIES, seriesCard.tmdbId, seriesCard.title, seriesCard.originalTitle, seasonNumber, ep.episodeNumber, seriesCard.mediaKey)
                EpisodeItem(seasonNumber, ep.episodeNumber, ep.name.ifBlank { "Episode ${ep.episodeNumber}" }, ep.overview.orEmpty(), TmdbImageUrl.poster(ep.stillPath), ep.runtime, ep.voteAverage, resolved.streams, resolved.subtitles)
            }
        }
        val local = cachedCatalogDao.getActiveItems().firstOrNull { it.mediaType == "SERIES" && ((seriesCard.tmdbId != null && it.tmdbId == seriesCard.tmdbId) || it.title.equals(seriesCard.title, true)) } ?: return@withContext emptyList()
        val season = JsonCatalogParser.decodePayload(local.payloadJson).seasons.firstOrNull { it.seasonNumber == seasonNumber } ?: return@withContext emptyList()
        season.episodes.map { ep ->
            val resolved = sourcesRepository.resolvePlayback(MediaType.SERIES, seriesCard.tmdbId, seriesCard.title, seriesCard.originalTitle, seasonNumber, ep.episodeNumber, seriesCard.mediaKey)
            EpisodeItem(seasonNumber, ep.episodeNumber, ep.title.ifBlank { "Episode ${ep.episodeNumber}" }, ep.overview, ep.stillUrl, resolvedStreams = resolved.streams, resolvedSubtitles = resolved.subtitles)
        }
    }

    // Cloud favorites
    fun observeFavorites(userId: String): Flow<List<FavoriteEntity>> = favoriteDao.observeForUserLegacy(userId)
    fun observeIsFavorite(userId: String, mediaKey: String): Flow<Boolean> = favoriteDao.observeIsFavoriteLegacy("${userId}_$mediaKey")

    suspend fun toggleFavoriteCloud(userId: String, card: MediaCardItem, currentlyFavorite: Boolean) {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return
        val recordKey = "${userId}_${card.mediaKey}"
        if (currentlyFavorite) {
            supabase.restDelete("favorites?user_id=eq.$userId&media_key=eq.${card.mediaKey}", token)
            favoriteDao.deleteByKey(recordKey)
        } else {
            supabase.restPost("favorites", buildJsonObject {
                put("media_key", card.mediaKey); put("user_id", userId); put("media_type", card.mediaType.name)
                put("title", card.title); put("poster_url", card.posterUrl); put("backdrop_url", card.backdropUrl)
                put("year", card.year); put("rating", card.rating); card.tmdbId?.let { put("tmdb_id", it) }
            }, token, "resolution=merge-duplicates,return=minimal")
            favoriteDao.upsert(FavoriteEntity(recordKey, card.mediaKey, 0L, card.mediaType.name, card.title, card.posterUrl, card.backdropUrl, card.directStreamUrl, card.tmdbId, card.rating, card.year, cloudUserId = userId))
        }
    }

    suspend fun syncCloudFavorites(userId: String) {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return
        val res = supabase.restGet("favorites?user_id=eq.$userId&select=*&order=created_at.desc", token).getOrNull() ?: return
        favoriteDao.clearForCloudUser(userId)
        res.asArrOrEmpty().mapNotNull { it.asObjOrNull() }.forEach { row ->
            val mk = row.str("media_key")
            favoriteDao.upsert(FavoriteEntity("${userId}_$mk", mk, 0L, row.str("media_type"), row.str("title"), row.str("poster_url"), row.str("backdrop_url"), "", row.intOrNull("tmdb_id"), row.double("rating"), row.str("year"), cloudUserId = userId))
        }
    }

    // Local watch history (kept local per device)
    fun observeWatchHistory(userId: String): Flow<List<WatchHistoryEntity>> = watchHistoryDao.observeForCloudUser(userId)
    suspend fun getWatchProgress(userId: String, mediaKey: String): WatchHistoryEntity? = watchHistoryDao.getByKey("${userId}_$mediaKey")
    suspend fun saveWatchProgress(userId: String, mediaKey: String, mediaType: MediaType, title: String, subtitle: String, posterUrl: String, streamUrl: String, tmdbId: Int?, seasonNumber: Int?, episodeNumber: Int?, positionMs: Long, durationMs: Long) {
        watchHistoryDao.upsert(WatchHistoryEntity("${userId}_$mediaKey", mediaKey, 0L, mediaType.name, title, subtitle, posterUrl, streamUrl, tmdbId, seasonNumber, episodeNumber, positionMs.coerceAtLeast(0L), durationMs.coerceAtLeast(0L), System.currentTimeMillis(), cloudUserId = userId))
    }
    suspend fun clearWatchHistory(userId: String) = watchHistoryDao.clearForCloudUser(userId)

    // Reactions
    suspend fun fetchReactions(mediaKey: String): ReactionState {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() }
        val res = supabase.restGet("reactions?media_key=eq.$mediaKey&select=reaction_type,user_id", token).getOrNull() ?: return ReactionState()
        val rows = res.asArrOrEmpty().mapNotNull { it.asObjOrNull() }
        val likes = rows.count { it.str("reaction_type") == "LIKE" }
        val dislikes = rows.count { it.str("reaction_type") == "DISLIKE" }
        val mine = rows.firstOrNull { it.str("user_id") == prefs.userId }?.str("reaction_type")
        return ReactionState(likes, dislikes, mine?.takeIf { it.isNotBlank() })
    }

    suspend fun setReaction(mediaKey: String, reactionType: String?): Result<ReactionState> = withContext(Dispatchers.IO) {
        runCatching {
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            val uid = prefs.userId
            if (reactionType == null) {
                supabase.restDelete("reactions?media_key=eq.$mediaKey&user_id=eq.$uid", token).getOrThrow()
            } else {
                // upsert by unique(media_key,user_id)
                val existing = supabase.restGet("reactions?media_key=eq.$mediaKey&user_id=eq.$uid&select=id", token).getOrNull()?.asArrOrEmpty()?.firstOrNull()?.asObjOrNull()
                if (existing == null) {
                    supabase.restPost("reactions", buildJsonObject { put("media_key", mediaKey); put("user_id", uid); put("reaction_type", reactionType) }, token).getOrThrow()
                } else {
                    supabase.restPatch("reactions?media_key=eq.$mediaKey&user_id=eq.$uid", buildJsonObject { put("reaction_type", reactionType) }, token).getOrThrow()
                }
            }
            fetchReactions(mediaKey)
        }
    }

    // Comments
    suspend fun fetchComments(mediaKey: String): List<CommentItem> = withContext(Dispatchers.IO) {
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() }
        val res = supabase.restGet("comments?media_key=eq.$mediaKey&select=id,media_key,user_id,content,created_at,profiles(name,role,avatar_color)&order=created_at.desc&limit=100", token).getOrNull() ?: return@withContext emptyList()
        res.asArrOrEmpty().mapNotNull { it.asObjOrNull() }.map { row ->
            val prof = row["profiles"]?.asObjOrNull()
            CommentItem(row.str("id"), row.str("media_key"), row.str("user_id"), prof?.str("name").orEmpty().ifBlank { "User" }, UserRole.from(prof?.str("role")), prof?.long("avatar_color") ?: 0xFFE50914L, row.str("content"), row.str("created_at"))
        }
    }

    suspend fun postComment(mediaKey: String, content: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            supabase.restPost("comments", buildJsonObject { put("media_key", mediaKey); put("user_id", prefs.userId); put("content", content.trim()) }, token).getOrThrow()
            Unit
        }
    }

    suspend fun deleteComment(commentId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            supabase.restDelete("comments?id=eq.$commentId", token).getOrThrow(); Unit
        }
    }

    private fun TmdbMediaDto.toCardItem(forcedType: MediaType? = null): MediaCardItem? {
        val type = forcedType ?: when (mediaType?.lowercase()) { "movie" -> MediaType.MOVIE; "tv" -> MediaType.SERIES; else -> return null }
        val displayTitle = (title ?: name).orEmpty(); if (displayTitle.isBlank()) return null
        return MediaCardItem(SourceMatcher.buildMediaKey(type, id, displayTitle), type, displayTitle, (originalTitle ?: originalName).orEmpty(), overview.orEmpty(), TmdbImageUrl.poster(posterPath), TmdbImageUrl.backdrop(backdropPath), (releaseDate ?: firstAirDate)?.take(4).orEmpty(), voteAverage, id)
    }

    fun CachedCatalogItemEntity.toMediaCardItem(): MediaCardItem {
        val type = if (mediaType.equals(MediaType.SERIES.name, true)) MediaType.SERIES else MediaType.MOVIE
        val payload = JsonCatalogParser.decodePayload(payloadJson)
        val primaryUrl = payload.qualities.firstOrNull()?.url ?: payload.streamUrl
        return MediaCardItem(SourceMatcher.buildMediaKey(type, tmdbId, title), type, titleAr.ifBlank { title }, originalTitle.ifBlank { title }, overview, posterUrl, backdropUrl.ifBlank { posterUrl }, year, rating, tmdbId, genres.split(",").map { it.trim() }.filter { it.isNotEmpty() }, primaryUrl)
    }
}
