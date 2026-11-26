package com.aluqabi.cinema.ui.cinema

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aluqabi.cinema.data.local.AppPreferences
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.local.entity.UserEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.data.remote.model.TmdbGenreDto
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.AuthResult
import com.aluqabi.cinema.data.repository.CatalogRepository
import com.aluqabi.cinema.data.repository.MovieDetailBundle
import com.aluqabi.cinema.data.repository.SeriesDetailBundle
import com.aluqabi.cinema.data.repository.SourcesRepository
import com.aluqabi.cinema.domain.model.EpisodeItem
import com.aluqabi.cinema.domain.model.LiveChannelItem
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.PlayerEpisodeEntry
import com.aluqabi.cinema.domain.model.PlayerLaunchRequest
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.domain.model.SourceType
import com.aluqabi.cinema.domain.model.StreamQualityOption
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CatalogUiState(
    val isLoadingHome: Boolean = false,
    val trending: List<MediaCardItem> = emptyList(),
    val popularMovies: List<MediaCardItem> = emptyList(),
    val topRatedMovies: List<MediaCardItem> = emptyList(),
    val popularSeries: List<MediaCardItem> = emptyList(),
    val topRatedSeries: List<MediaCardItem> = emptyList(),
    val movieGenres: List<TmdbGenreDto> = emptyList(),
    val seriesGenres: List<TmdbGenreDto> = emptyList(),
    val selectedMovieGenreId: Int? = null,
    val selectedSeriesGenreId: Int? = null,
    val tmdbStatusMessage: String? = null
)

data class DetailUiState(
    val isLoading: Boolean = false,
    val movieDetail: MovieDetailBundle? = null,
    val seriesDetail: SeriesDetailBundle? = null,
    val selectedSeason: Int = 1,
    val episodes: List<EpisodeItem> = emptyList(),
    val resolvedMoviePlayback: ResolvedPlayback = ResolvedPlayback(),
    val isLoadingEpisodes: Boolean = false
)

class CinemaViewModel(
    private val settingsDataStore: SettingsDataStore,
    private val authRepository: AuthRepository,
    private val sourcesRepository: SourcesRepository,
    private val catalogRepository: CatalogRepository
) : ViewModel() {

    val preferences: StateFlow<AppPreferences> = settingsDataStore.preferences
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AppPreferences())

    val currentUser: StateFlow<UserEntity?> = authRepository.currentUser
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val sources: StateFlow<List<SourceEntity>> = sourcesRepository.sources
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val liveChannels: StateFlow<List<LiveChannelItem>> = sourcesRepository.liveChannels
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val customMediaCards: StateFlow<List<MediaCardItem>> = sourcesRepository.customCatalogItems
        .combine(preferences) { items, _ ->
            with(catalogRepository) {
                items.map { it.toMediaCardItem() }
            }
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val favorites: StateFlow<List<FavoriteEntity>> = currentUser
        .flatMapLatest { user ->
            if (user == null) flowOf(emptyList()) else catalogRepository.observeFavorites(user.id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val watchHistory: StateFlow<List<WatchHistoryEntity>> = currentUser
        .flatMapLatest { user ->
            if (user == null) flowOf(emptyList()) else catalogRepository.observeWatchHistory(user.id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _catalogState = MutableStateFlow(CatalogUiState())
    val catalogState: StateFlow<CatalogUiState> = _catalogState.asStateFlow()

    private val _detailState = MutableStateFlow(DetailUiState())
    val detailState: StateFlow<DetailUiState> = _detailState.asStateFlow()

    private val _searchResults = MutableStateFlow<List<MediaCardItem>>(emptyList())
    val searchResults: StateFlow<List<MediaCardItem>> = _searchResults.asStateFlow()

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching.asStateFlow()

    private val _statusBanner = MutableStateFlow<String?>(null)
    val statusBanner: StateFlow<String?> = _statusBanner.asStateFlow()

    private var lastLoadedApiKey: String? = null
    private var lastLoadedLang: String? = null

    init {
        viewModelScope.launch {
            preferences.collect { prefs ->
                if (prefs.tmdbApiKey.isNotBlank() &&
                    (prefs.tmdbApiKey != lastLoadedApiKey || prefs.languageCode != lastLoadedLang)
                ) {
                    lastLoadedApiKey = prefs.tmdbApiKey
                    lastLoadedLang = prefs.languageCode
                    refreshTmdbCatalog(prefs.tmdbApiKey, prefs.languageCode)
                }
            }
        }
    }

    fun clearBanner() {
        _statusBanner.value = null
    }

    fun refreshTmdbCatalog(
        apiKey: String = preferences.value.tmdbApiKey,
        languageCode: String = preferences.value.languageCode
    ) {
        if (apiKey.isBlank()) return
        viewModelScope.launch {
            _catalogState.update { it.copy(isLoadingHome = true, tmdbStatusMessage = null) }
            val trending = catalogRepository.fetchTrending(apiKey, languageCode).getOrDefault(emptyList())
            val popMovies = catalogRepository.fetchPopularMovies(apiKey, languageCode, _catalogState.value.selectedMovieGenreId)
                .getOrDefault(emptyList())
            val topMovies = catalogRepository.fetchTopRatedMovies(apiKey, languageCode).getOrDefault(emptyList())
            val popSeries = catalogRepository.fetchPopularSeries(apiKey, languageCode, _catalogState.value.selectedSeriesGenreId)
                .getOrDefault(emptyList())
            val topSeries = catalogRepository.fetchTopRatedSeries(apiKey, languageCode).getOrDefault(emptyList())
            val movieGenres = catalogRepository.fetchMovieGenres(apiKey, languageCode)
            val seriesGenres = catalogRepository.fetchSeriesGenres(apiKey, languageCode)

            _catalogState.update {
                it.copy(
                    isLoadingHome = false,
                    trending = trending,
                    popularMovies = popMovies,
                    topRatedMovies = topMovies,
                    popularSeries = popSeries,
                    topRatedSeries = topSeries,
                    movieGenres = movieGenres,
                    seriesGenres = seriesGenres
                )
            }
        }
    }

    fun selectMovieGenre(genreId: Int?) {
        _catalogState.update { it.copy(selectedMovieGenreId = genreId) }
        val prefs = preferences.value
        if (prefs.tmdbApiKey.isBlank()) return
        viewModelScope.launch {
            val movies = catalogRepository.fetchPopularMovies(prefs.tmdbApiKey, prefs.languageCode, genreId)
                .getOrDefault(emptyList())
            _catalogState.update { it.copy(popularMovies = movies) }
        }
    }

    fun selectSeriesGenre(genreId: Int?) {
        _catalogState.update { it.copy(selectedSeriesGenreId = genreId) }
        val prefs = preferences.value
        if (prefs.tmdbApiKey.isBlank()) return
        viewModelScope.launch {
            val series = catalogRepository.fetchPopularSeries(prefs.tmdbApiKey, prefs.languageCode, genreId)
                .getOrDefault(emptyList())
            _catalogState.update { it.copy(popularSeries = series) }
        }
    }

    fun performSearch(query: String) {
        val prefs = preferences.value
        viewModelScope.launch {
            _isSearching.value = true
            _searchResults.value = catalogRepository.searchCatalog(prefs.tmdbApiKey, prefs.languageCode, query)
            _isSearching.value = false
        }
    }

    fun openMediaDetail(card: MediaCardItem) {
        val prefs = preferences.value
        viewModelScope.launch {
            _detailState.value = DetailUiState(isLoading = true)
            if (card.mediaType == MediaType.MOVIE) {
                val bundle = catalogRepository.getMovieDetails(
                    apiKey = prefs.tmdbApiKey,
                    languageCode = prefs.languageCode,
                    tmdbId = card.tmdbId,
                    fallbackCard = card
                )
                val resolved = sourcesRepository.resolvePlayback(
                    mediaType = MediaType.MOVIE,
                    tmdbId = bundle.card.tmdbId,
                    title = bundle.card.title,
                    originalTitle = bundle.card.originalTitle,
                    fallbackKey = bundle.card.mediaKey
                )
                _detailState.value = DetailUiState(
                    isLoading = false,
                    movieDetail = bundle,
                    resolvedMoviePlayback = resolved
                )
            } else {
                val bundle = catalogRepository.getSeriesDetails(
                    apiKey = prefs.tmdbApiKey,
                    languageCode = prefs.languageCode,
                    tmdbId = card.tmdbId,
                    fallbackCard = card
                )
                val firstSeason = bundle.seasons.firstOrNull()?.seasonNumber ?: 1
                _detailState.value = DetailUiState(
                    isLoading = false,
                    seriesDetail = bundle,
                    selectedSeason = firstSeason,
                    isLoadingEpisodes = true
                )
                val episodes = catalogRepository.getSeasonEpisodes(
                    apiKey = prefs.tmdbApiKey,
                    languageCode = prefs.languageCode,
                    seriesCard = bundle.card,
                    seasonNumber = firstSeason
                )
                _detailState.update {
                    it.copy(episodes = episodes, isLoadingEpisodes = false)
                }
            }
        }
    }

    fun selectSeason(seasonNumber: Int) {
        val seriesCard = _detailState.value.seriesDetail?.card ?: return
        val prefs = preferences.value
        viewModelScope.launch {
            _detailState.update { it.copy(selectedSeason = seasonNumber, isLoadingEpisodes = true) }
            val episodes = catalogRepository.getSeasonEpisodes(
                apiKey = prefs.tmdbApiKey,
                languageCode = prefs.languageCode,
                seriesCard = seriesCard,
                seasonNumber = seasonNumber
            )
            _detailState.update { it.copy(episodes = episodes, isLoadingEpisodes = false) }
        }
    }

    fun saveManualLinkForMovie(
        card: MediaCardItem,
        streamUrl: String,
        subtitleUrl: String
    ) {
        viewModelScope.launch {
            sourcesRepository.saveManualLinkOverride(
                mediaType = MediaType.MOVIE,
                tmdbId = card.tmdbId,
                fallbackKey = card.mediaKey,
                streamUrl = streamUrl,
                subtitleUrl = subtitleUrl
            )
            val resolved = sourcesRepository.resolvePlayback(
                mediaType = MediaType.MOVIE,
                tmdbId = card.tmdbId,
                title = card.title,
                originalTitle = card.originalTitle,
                fallbackKey = card.mediaKey
            )
            _detailState.update { it.copy(resolvedMoviePlayback = resolved) }
        }
    }

    fun saveManualLinkForEpisode(
        seriesCard: MediaCardItem,
        seasonNumber: Int,
        episodeNumber: Int,
        streamUrl: String,
        subtitleUrl: String
    ) {
        val prefs = preferences.value
        viewModelScope.launch {
            sourcesRepository.saveManualLinkOverride(
                mediaType = MediaType.SERIES,
                tmdbId = seriesCard.tmdbId,
                fallbackKey = seriesCard.mediaKey,
                seasonNumber = seasonNumber,
                episodeNumber = episodeNumber,
                streamUrl = streamUrl,
                subtitleUrl = subtitleUrl
            )
            val episodes = catalogRepository.getSeasonEpisodes(
                apiKey = prefs.tmdbApiKey,
                languageCode = prefs.languageCode,
                seriesCard = seriesCard,
                seasonNumber = seasonNumber
            )
            _detailState.update { it.copy(episodes = episodes) }
        }
    }

    suspend fun buildMoviePlayerRequest(card: MediaCardItem, resolved: ResolvedPlayback): PlayerLaunchRequest? {
        val streams = resolved.streams.ifEmpty {
            if (card.directStreamUrl.isNotBlank()) {
                listOf(StreamQualityOption("Auto", card.directStreamUrl))
            } else {
                emptyList()
            }
        }
        if (streams.isEmpty()) return null
        val userId = currentUser.value?.id
        val progress = if (userId != null) catalogRepository.getWatchProgress(userId, card.mediaKey) else null
        return PlayerLaunchRequest(
            mediaKey = card.mediaKey,
            mediaType = MediaType.MOVIE,
            title = card.title,
            subtitle = card.year,
            posterUrl = card.posterUrl,
            tmdbId = card.tmdbId,
            streamOptions = streams,
            externalSubtitles = resolved.subtitles,
            initialPositionMs = progress?.positionMs ?: 0L
        )
    }

    suspend fun buildEpisodePlayerRequest(
        seriesCard: MediaCardItem,
        episode: EpisodeItem,
        allEpisodesInSeason: List<EpisodeItem>
    ): PlayerLaunchRequest? {
        if (episode.resolvedStreams.isEmpty()) return null
        val epKey = "${seriesCard.mediaKey}_s${episode.seasonNumber}_e${episode.episodeNumber}"
        val userId = currentUser.value?.id
        val progress = if (userId != null) catalogRepository.getWatchProgress(userId, epKey) else null
        val queue = allEpisodesInSeason.mapNotNull { item ->
            val primary = item.resolvedStreams.firstOrNull()?.url ?: return@mapNotNull null
            PlayerEpisodeEntry(
                seasonNumber = item.seasonNumber,
                episodeNumber = item.episodeNumber,
                title = item.title,
                streamUrl = primary,
                qualities = item.resolvedStreams,
                subtitles = item.resolvedSubtitles
            )
        }
        return PlayerLaunchRequest(
            mediaKey = epKey,
            mediaType = MediaType.SERIES,
            title = seriesCard.title,
            subtitle = "S${episode.seasonNumber} E${episode.episodeNumber} - ${episode.title}",
            posterUrl = episode.stillUrl.ifBlank { seriesCard.posterUrl },
            tmdbId = seriesCard.tmdbId,
            streamOptions = episode.resolvedStreams,
            externalSubtitles = episode.resolvedSubtitles,
            initialPositionMs = progress?.positionMs ?: 0L,
            seasonNumber = episode.seasonNumber,
            episodeNumber = episode.episodeNumber,
            episodesQueue = queue
        )
    }

    fun buildChannelPlayerRequest(channel: LiveChannelItem): PlayerLaunchRequest {
        return PlayerLaunchRequest(
            mediaKey = "live_${channel.id}_${channel.streamUrl.hashCode()}",
            mediaType = MediaType.LIVE_TV,
            title = channel.name,
            subtitle = channel.groupTitle,
            posterUrl = channel.logoUrl,
            streamOptions = listOf(StreamQualityOption("Live", channel.streamUrl))
        )
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    fun observeIsFavorite(mediaKey: String): Flow<Boolean> = currentUser.flatMapLatest { user ->
        if (user == null) flowOf(false) else catalogRepository.observeIsFavorite(user.id, mediaKey)
    }

    fun toggleFavorite(card: MediaCardItem, isFav: Boolean) {
        val userId = currentUser.value?.id ?: return
        viewModelScope.launch {
            catalogRepository.toggleFavorite(userId, card, isFav)
        }
    }

    fun saveWatchProgress(
        request: PlayerLaunchRequest,
        activeStreamUrl: String,
        positionMs: Long,
        durationMs: Long
    ) {
        val userId = currentUser.value?.id ?: return
        viewModelScope.launch {
            catalogRepository.saveWatchProgress(
                userId = userId,
                mediaKey = request.mediaKey,
                mediaType = request.mediaType,
                title = request.title,
                subtitle = request.subtitle,
                posterUrl = request.posterUrl,
                streamUrl = activeStreamUrl,
                tmdbId = request.tmdbId,
                seasonNumber = request.seasonNumber,
                episodeNumber = request.episodeNumber,
                positionMs = positionMs,
                durationMs = durationMs
            )
        }
    }

    fun saveTmdbApiKey(apiKey: String) {
        viewModelScope.launch {
            settingsDataStore.setTmdbApiKey(apiKey)
            val isAr = preferences.value.languageCode != "en"
            _statusBanner.value = if (isAr) "تم حفظ مفتاح TMDB" else "TMDB API Key saved"
            if (apiKey.isNotBlank()) {
                refreshTmdbCatalog(apiKey, preferences.value.languageCode)
            }
        }
    }

    fun testTmdbKey(apiKey: String) {
        viewModelScope.launch {
            val isAr = preferences.value.languageCode != "en"
            val result = catalogRepository.testTmdbConnection(apiKey, preferences.value.languageCode)
            _statusBanner.value = result.fold(
                onSuccess = { count ->
                    if (isAr) "نجح الاتصال بـ TMDB ($count عمل)" else "TMDB connected ($count items)"
                },
                onFailure = { err ->
                    if (isAr) "فشل الاتصال: ${err.message}" else "Connection failed: ${err.message}"
                }
            )
        }
    }

    fun addSource(name: String, type: SourceType, url: String) {
        viewModelScope.launch {
            val isAr = preferences.value.languageCode != "en"
            val res = sourcesRepository.addAndSyncSource(name, type, url)
            _statusBanner.value = res.fold(
                onSuccess = { src ->
                    if (isAr) "تمت إضافة وتحديث ${src.name} (${src.itemCount})" else "Added & synced ${src.name} (${src.itemCount})"
                },
                onFailure = { err ->
                    if (isAr) "حُفظ المصدر مع خطأ مزامنة: ${err.message}" else "Sync error: ${err.message}"
                }
            )
        }
    }

    fun updateSource(source: SourceEntity, newName: String, newUrl: String) {
        viewModelScope.launch {
            sourcesRepository.updateAndSyncSource(
                source.copy(name = newName.trim().ifBlank { source.name }, url = newUrl.trim())
            )
        }
    }

    fun syncSource(source: SourceEntity) {
        viewModelScope.launch {
            val isAr = preferences.value.languageCode != "en"
            val res = sourcesRepository.syncSource(source)
            _statusBanner.value = res.fold(
                onSuccess = { src ->
                    if (isAr) "تم تحديث ${src.name} (${src.itemCount})" else "Synced ${src.name} (${src.itemCount})"
                },
                onFailure = { err ->
                    if (isAr) "فشل التحديث: ${err.message}" else "Sync failed: ${err.message}"
                }
            )
        }
    }

    fun syncAllSources() {
        viewModelScope.launch {
            sourcesRepository.syncAllEnabledSources()
            val isAr = preferences.value.languageCode != "en"
            _statusBanner.value = if (isAr) "تم تحديث جميع المصادر المفعلة" else "All enabled sources synced"
        }
    }

    fun toggleSource(source: SourceEntity, enabled: Boolean) {
        viewModelScope.launch { sourcesRepository.toggleSourceEnabled(source, enabled) }
    }

    fun deleteSource(sourceId: Long) {
        viewModelScope.launch { sourcesRepository.deleteSource(sourceId) }
    }

    fun setLanguage(languageCode: String) {
        viewModelScope.launch {
            settingsDataStore.setLanguageCode(languageCode)
        }
    }

    fun updateSubtitleDefaults(fontSizeSp: Float, textColorArgb: Long, bgColorArgb: Long) {
        viewModelScope.launch {
            settingsDataStore.updateSubtitleStyle(fontSizeSp, textColorArgb, bgColorArgb)
        }
    }

    fun updateDefaultAspectMode(mode: String) {
        viewModelScope.launch { settingsDataStore.setDefaultAspectMode(mode) }
    }

    fun updateProfile(
        newName: String,
        newEmail: String?,
        newPhone: String?,
        avatarColor: Long,
        onResult: (AuthResult) -> Unit
    ) {
        val user = currentUser.value ?: return
        viewModelScope.launch {
            val res = authRepository.updateProfile(user, newName, newEmail, newPhone, avatarColor)
            onResult(res)
        }
    }

    fun clearHistory() {
        val userId = currentUser.value?.id ?: return
        viewModelScope.launch {
            catalogRepository.clearWatchHistory(userId)
            val isAr = preferences.value.languageCode != "en"
            _statusBanner.value = if (isAr) "تم مسح سجل المشاهدة" else "Watch history cleared"
        }
    }

    fun logout() {
        viewModelScope.launch { authRepository.logout() }
    }

    class Factory(
        private val settingsDataStore: SettingsDataStore,
        private val authRepository: AuthRepository,
        private val sourcesRepository: SourcesRepository,
        private val catalogRepository: CatalogRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return CinemaViewModel(
                settingsDataStore = settingsDataStore,
                authRepository = authRepository,
                sourcesRepository = sourcesRepository,
                catalogRepository = catalogRepository
            ) as T
        }
    }
}
