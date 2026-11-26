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
import com.aluqabi.cinema.data.remote.arr
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
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.SubtitleTrackOption
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
                val mergedSeasons = mergeCloudSeasonSummaries(seasons, tmdbId, card.title)
                return@withContext SeriesDetailBundle(card, remote.genres.map { it.name }, mergedSeasons)
            }
        }
        val local = cachedCatalogDao.getActiveItems().firstOrNull { it.mediaType == "SERIES" && ((tmdbId != null && it.tmdbId == tmdbId) || (fallbackCard != null && it.title.equals(fallbackCard.title, true))) }
        val localSeasons = local?.let { JsonCatalogParser.decodePayload(it.payloadJson).seasons.map { s -> SeasonSummary(s.seasonNumber, "Season ${s.seasonNumber}", s.episodes.size) } }.orEmpty()
        val cloudSeasons = fetchCloudSeasonSummaries(tmdbId, fallbackCard?.title ?: local?.title.orEmpty())
        val seasons = mergeSeasonSummaries(localSeasons, cloudSeasons).ifEmpty { listOf(SeasonSummary(1, "Season 1", 0)) }
        SeriesDetailBundle(fallbackCard ?: local?.toMediaCardItem() ?: MediaCardItem("series_${tmdbId ?: 0}", MediaType.SERIES, "Series", tmdbId = tmdbId), fallbackCard?.genres.orEmpty(), seasons)
    }

    suspend fun getSeasonEpisodes(apiKey: String = tmdbKey(), languageCode: String = "ar", seriesCard: MediaCardItem, seasonNumber: Int): List<EpisodeItem> = withContext(Dispatchers.IO) {
        val cloudRows = fetchCloudEpisodes(seriesCard, seasonNumber)
        val cloudByEpisode = cloudRows.associateBy { it.episodeNumber }
        val remote = if (seriesCard.tmdbId != null && apiKey.isNotBlank()) runCatching { val (k, b) = authPair(apiKey); tmdbApi.getSeasonDetails(seriesCard.tmdbId, seasonNumber, k, b, tmdbLang(languageCode)).episodes }.getOrDefault(emptyList()) else emptyList()
        if (remote.isNotEmpty()) {
            return@withContext remote.map { ep ->
                val resolved = sourcesRepository.resolvePlayback(MediaType.SERIES, seriesCard.tmdbId, seriesCard.title, seriesCard.originalTitle, seasonNumber, ep.episodeNumber, seriesCard.mediaKey)
                val cloud = cloudByEpisode[ep.episodeNumber]
                val streams = cloud?.streams?.takeIf { it.isNotEmpty() } ?: resolved.streams
                val subtitles = cloud?.subtitles?.takeIf { it.isNotEmpty() } ?: resolved.subtitles
                EpisodeItem(
                    seasonNumber,
                    ep.episodeNumber,
                    cloud?.title?.ifBlank { ep.name.ifBlank { "Episode ${ep.episodeNumber}" } } ?: ep.name.ifBlank { "Episode ${ep.episodeNumber}" },
                    cloud?.overview?.ifBlank { ep.overview.orEmpty() } ?: ep.overview.orEmpty(),
                    cloud?.stillUrl?.ifBlank { TmdbImageUrl.poster(ep.stillPath) } ?: TmdbImageUrl.poster(ep.stillPath),
                    ep.runtime,
                    ep.voteAverage,
                    streams,
                    subtitles
                )
            }
        }
        val local = cachedCatalogDao.getActiveItems().firstOrNull { it.mediaType == "SERIES" && ((seriesCard.tmdbId != null && it.tmdbId == seriesCard.tmdbId) || it.title.equals(seriesCard.title, true)) }
        val localSeason = local?.let { JsonCatalogParser.decodePayload(it.payloadJson).seasons.firstOrNull { it.seasonNumber == seasonNumber } }
        if (localSeason != null) {
            val localEpisodes = localSeason.episodes.map { ep ->
                val resolved = sourcesRepository.resolvePlayback(MediaType.SERIES, seriesCard.tmdbId, seriesCard.title, seriesCard.originalTitle, seasonNumber, ep.episodeNumber, seriesCard.mediaKey)
                val cloud = cloudByEpisode[ep.episodeNumber]
                val streams = cloud?.streams?.takeIf { it.isNotEmpty() } ?: resolved.streams
                val subtitles = cloud?.subtitles?.takeIf { it.isNotEmpty() } ?: resolved.subtitles
                EpisodeItem(
                    seasonNumber,
                    ep.episodeNumber,
                    cloud?.title?.ifBlank { ep.title.ifBlank { "Episode ${ep.episodeNumber}" } } ?: ep.title.ifBlank { "Episode ${ep.episodeNumber}" },
                    cloud?.overview?.ifBlank { ep.overview } ?: ep.overview,
                    cloud?.stillUrl?.ifBlank { ep.stillUrl } ?: ep.stillUrl,
                    resolvedStreams = streams,
                    resolvedSubtitles = subtitles
                )
            }
            val localNums = localEpisodes.map { it.episodeNumber }.toSet()
            val extras = cloudRows.filter { it.episodeNumber !in localNums }.map { cloud ->
                EpisodeItem(seasonNumber, cloud.episodeNumber, cloud.title.ifBlank { "Episode ${cloud.episodeNumber}" }, cloud.overview, cloud.stillUrl, resolvedStreams = cloud.streams, resolvedSubtitles = cloud.subtitles)
            }
            return@withContext (localEpisodes + extras).sortedBy { it.episodeNumber }
        }
        cloudRows.map { cloud ->
            EpisodeItem(seasonNumber, cloud.episodeNumber, cloud.title.ifBlank { "Episode ${cloud.episodeNumber}" }, cloud.overview, cloud.stillUrl, resolvedStreams = cloud.streams, resolvedSubtitles = cloud.subtitles)
        }.sortedBy { it.episodeNumber }
    }

    // Cloud favorites
    fun observeFavorites(userId: String): Flow<List<FavoriteEntity>> = favoriteDao.observeForUserLegacy(userId)
    fun observeIsFavorite(userId: String, mediaKey: String): Flow<Boolean> = favoriteDao.observeIsFavoriteLegacy("${userId}_$mediaKey")

    suspend fun toggleFavoriteCloud(userId: String, card: MediaCardItem, currentlyFavorite: Boolean) {
        if (!AppConfig.isSupabaseConfigured) return
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: return
        val recordKey = "${userId}_${card.mediaKey}"
        if (currentlyFavorite) {
            val res = supabase.restDelete("favorites?user_id=eq.$userId&media_key=eq.${card.mediaKey}", token)
            if (res.isSuccess) favoriteDao.deleteByKey(recordKey)
        } else {
            val res = supabase.restPost("favorites?on_conflict=media_key,user_id", buildJsonObject {
                put("media_key", card.mediaKey); put("user_id", userId); put("media_type", card.mediaType.name)
                put("title", card.title); put("poster_url", card.posterUrl); put("backdrop_url", card.backdropUrl)
                put("year", card.year); put("rating", card.rating); card.tmdbId?.let { put("tmdb_id", it) }
            }, token, "resolution=merge-duplicates,return=minimal")
            if (res.isSuccess) {
                favoriteDao.upsert(FavoriteEntity(recordKey, card.mediaKey, 0L, card.mediaType.name, card.title, card.posterUrl, card.backdropUrl, card.directStreamUrl, card.tmdbId, card.rating, card.year, cloudUserId = userId))
            }
        }
    }

    suspend fun syncCloudFavorites(userId: String) {
        if (!AppConfig.isSupabaseConfigured) return
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
        if (!AppConfig.isSupabaseConfigured) return ReactionState()
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
            if (!AppConfig.isSupabaseConfigured) error("Supabase is not configured")
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            val uid = prefs.userId
            if (reactionType == null) {
                supabase.restDelete("reactions?media_key=eq.$mediaKey&user_id=eq.$uid", token).getOrThrow()
            } else {
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
        if (!AppConfig.isSupabaseConfigured) return@withContext emptyList()
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
            if (!AppConfig.isSupabaseConfigured) error("Supabase is not configured")
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            supabase.restPost("comments", buildJsonObject { put("media_key", mediaKey); put("user_id", prefs.userId); put("content", content.trim()) }, token).getOrThrow()
            Unit
        }
    }

    suspend fun deleteComment(commentId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            if (!AppConfig.isSupabaseConfigured) error("Supabase is not configured")
            val prefs = settingsDataStore.preferences.first()
            val token = prefs.accessToken.takeIf { it.isNotBlank() } ?: error("Not signed in")
            supabase.restDelete("comments?id=eq.$commentId", token).getOrThrow(); Unit
        }
    }

    private data class CloudEpisode(
        val episodeNumber: Int,
        val title: String,
        val overview: String,
        val stillUrl: String,
        val streams: List<StreamQualityOption>,
        val subtitles: List<SubtitleTrackOption>
    )

    private suspend fun fetchCloudEpisodes(seriesCard: MediaCardItem, seasonNumber: Int): List<CloudEpisode> {
        if (!AppConfig.isSupabaseConfigured) return emptyList()
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() }
        val rows = linkedMapOf<Int, CloudEpisode>()

        suspend fun collectFromPath(path: String) {
            val res = supabase.restGet(path, token).getOrNull() ?: return
            res.asArrOrEmpty().mapNotNull { it.asObjOrNull() }.forEach { row ->
                val epNum = row.intOrNull("episode_number") ?: return@forEach
                val streamUrl = row.str("stream_url")
                val qualities = parseCloudQualities(row.arr("qualities"), streamUrl)
                val subtitles = parseCloudSubtitles(row.arr("subtitles"))
                rows[epNum] = CloudEpisode(
                    episodeNumber = epNum,
                    title = row.str("title"),
                    overview = row.str("overview"),
                    stillUrl = row.str("still_url").ifBlank { row.str("poster_url") },
                    streams = qualities,
                    subtitles = subtitles
                )
            }
        }

        seriesCard.tmdbId?.let { tmdbId ->
            collectFromPath("series_episodes?series_tmdb_id=eq.$tmdbId&season_number=eq.$seasonNumber&select=*&order=episode_number.asc")
        }

        val catalogItemId = findCloudCatalogItemId(seriesCard)
        if (catalogItemId != null) {
            collectFromPath("series_episodes?catalog_item_id=eq.$catalogItemId&season_number=eq.$seasonNumber&select=*&order=episode_number.asc")
        }

        return rows.values.sortedBy { it.episodeNumber }
    }

    private suspend fun fetchCloudSeasonSummaries(tmdbId: Int?, title: String): List<SeasonSummary> {
        if (!AppConfig.isSupabaseConfigured) return emptyList()
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() }
        val seasonCounts = linkedMapOf<Int, Int>()

        suspend fun collect(path: String) {
            val res = supabase.restGet(path, token).getOrNull() ?: return
            res.asArrOrEmpty().mapNotNull { it.asObjOrNull() }.forEach { row ->
                val season = row.intOrNull("season_number") ?: return@forEach
                if (season <= 0) return@forEach
                seasonCounts[season] = (seasonCounts[season] ?: 0) + 1
            }
        }

        if (tmdbId != null) {
            collect("series_episodes?series_tmdb_id=eq.$tmdbId&select=season_number")
        }
        val catalogItemId = findCloudCatalogItemId(tmdbId, title)
        if (catalogItemId != null) {
            collect("series_episodes?catalog_item_id=eq.$catalogItemId&select=season_number")
        }

        return seasonCounts.entries.sortedBy { it.key }.map { (season, count) ->
            SeasonSummary(season, "Season $season", count)
        }
    }

    private suspend fun mergeCloudSeasonSummaries(existing: List<SeasonSummary>, tmdbId: Int?, title: String): List<SeasonSummary> {
        val cloud = fetchCloudSeasonSummaries(tmdbId, title)
        return mergeSeasonSummaries(existing, cloud)
    }

    private fun mergeSeasonSummaries(primary: List<SeasonSummary>, secondary: List<SeasonSummary>): List<SeasonSummary> {
        if (primary.isEmpty()) return secondary.sortedBy { it.seasonNumber }
        if (secondary.isEmpty()) return primary.sortedBy { it.seasonNumber }
        val bySeason = linkedMapOf<Int, SeasonSummary>()
        primary.forEach { bySeason[it.seasonNumber] = it }
        secondary.forEach { cloud ->
            val current = bySeason[cloud.seasonNumber]
            if (current == null) {
                bySeason[cloud.seasonNumber] = cloud
            } else if (current.episodeCount <= 0 && cloud.episodeCount > 0) {
                bySeason[cloud.seasonNumber] = current.copy(episodeCount = cloud.episodeCount)
            }
        }
        return bySeason.values.sortedBy { it.seasonNumber }
    }

    private suspend fun findCloudCatalogItemId(seriesCard: MediaCardItem): String? = findCloudCatalogItemId(seriesCard.tmdbId, seriesCard.title)

    private suspend fun findCloudCatalogItemId(tmdbId: Int?, title: String): String? {
        if (!AppConfig.isSupabaseConfigured) return null
        val prefs = settingsDataStore.preferences.first()
        val token = prefs.accessToken.takeIf { it.isNotBlank() }
        if (tmdbId != null) {
            val byTmdb = supabase.restGet("movies_catalog?tmdb_id=eq.$tmdbId&media_type=eq.SERIES&select=id&limit=1", token).getOrNull()
            val id = byTmdb?.asArrOrEmpty()?.firstOrNull()?.asObjOrNull()?.str("id")
            if (!id.isNullOrBlank()) return id
        }
        val cleanTitle = title.trim()
        if (cleanTitle.isBlank()) return null
        val encoded = java.net.URLEncoder.encode(cleanTitle, "UTF-8")
        val byTitle = supabase.restGet("movies_catalog?media_type=eq.SERIES&title=eq.$encoded&select=id&limit=1", token).getOrNull()
        return byTitle?.asArrOrEmpty()?.firstOrNull()?.asObjOrNull()?.str("id")?.takeIf { it.isNotBlank() }
    }

    private fun parseCloudQualities(arr: kotlinx.serialization.json.JsonArray, fallbackUrl: String): List<StreamQualityOption> {
        val parsed = arr.mapNotNull { el ->
            val obj = el.asObjOrNull() ?: return@mapNotNull null
            val url = obj.str("url").ifBlank { obj.str("stream_url") }
            if (url.isBlank()) null else StreamQualityOption(obj.str("label").ifBlank { obj.str("quality").ifBlank { "Auto" } }, url)
        }
        return parsed.ifEmpty { if (fallbackUrl.isNotBlank()) listOf(StreamQualityOption("Auto", fallbackUrl)) else emptyList() }
    }

    private fun parseCloudSubtitles(arr: kotlinx.serialization.json.JsonArray): List<SubtitleTrackOption> {
        return arr.mapNotNull { el ->
            val obj = el.asObjOrNull() ?: return@mapNotNull null
            val url = obj.str("url")
            if (url.isBlank()) null else SubtitleTrackOption(obj.str("label").ifBlank { obj.str("lang").ifBlank { "Subtitle" } }, obj.str("language").ifBlank { obj.str("lang").ifBlank { "ar" } }, url)
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
