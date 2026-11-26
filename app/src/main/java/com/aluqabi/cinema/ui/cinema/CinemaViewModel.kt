package com.aluqabi.cinema.ui.cinema

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aluqabi.cinema.config.AppConfig
import com.aluqabi.cinema.data.local.AppPreferences
import com.aluqabi.cinema.data.local.SettingsDataStore
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.data.remote.model.TmdbGenreDto
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.AuthResult
import com.aluqabi.cinema.data.repository.CatalogRepository
import com.aluqabi.cinema.data.repository.MovieDetailBundle
import com.aluqabi.cinema.data.repository.SeriesDetailBundle
import com.aluqabi.cinema.data.repository.SourcesRepository
import com.aluqabi.cinema.domain.model.CommentItem
import com.aluqabi.cinema.domain.model.EpisodeItem
import com.aluqabi.cinema.domain.model.LiveChannelItem
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.PlayerEpisodeEntry
import com.aluqabi.cinema.domain.model.PlayerLaunchRequest
import com.aluqabi.cinema.domain.model.ReactionState
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.domain.model.SourceType
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.UserProfile
import com.aluqabi.cinema.domain.model.UserRole
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
import kotlinx.coroutines.isActive
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
    val isLoadingEpisodes: Boolean = false,
    val reactions: ReactionState = ReactionState(),
    val comments: List<CommentItem> = emptyList(),
    val isCommentsLoading: Boolean = false
)

class CinemaViewModel(
    private val settingsDataStore: SettingsDataStore,
    private val authRepository: AuthRepository,
    private val sourcesRepository: SourcesRepository,
    private val catalogRepository: CatalogRepository
) : ViewModel() {

    val preferences: StateFlow<AppPreferences> = settingsDataStore.preferences
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), AppPreferences())

    private val _currentProfile = MutableStateFlow<UserProfile?>(null)
    val currentProfile: StateFlow<UserProfile?> = _currentProfile.asStateFlow()

    private val _authLoading = MutableStateFlow(true)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    val sources: StateFlow<List<SourceEntity>> = sourcesRepository.sources
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val liveChannels: StateFlow<List<LiveChannelItem>> = sourcesRepository.liveChannels
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val customMediaCards: StateFlow<List<MediaCardItem>> = sourcesRepository.customCatalogItems
        .combine(preferences) { items, _ -> with(catalogRepository) { items.map { it.toMediaCardItem() } } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val favorites: StateFlow<List<FavoriteEntity>> = _currentProfile
        .flatMapLatest { user -> if (user == null) flowOf(emptyList()) else catalogRepository.observeFavorites(user.id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    @OptIn(ExperimentalCoroutinesApi::class)
    val watchHistory: StateFlow<List<WatchHistoryEntity>> = _currentProfile
        .flatMapLatest { user -> if (user == null) flowOf(emptyList()) else catalogRepository.observeWatchHistory(user.id) }
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

    private var lastLoadedLang: String? = null
    private var lastLoadedUserId: String? = null
    private var lastAttemptedUserId: String? = null
    private var authAttemptToken = 0
    private var searchJob: Job? = null

    init {
        viewModelScope.launch {
            settingsDataStore.preferences.collect { prefs ->
                if (prefs.userId.isBlank()) {
                    lastAttemptedUserId = null
                    lastLoadedUserId = null
                    authAttemptToken++
                    _authLoading.value = false
                    _currentProfile.value = null
                } else if (prefs.userId != lastAttemptedUserId) {
                    lastAttemptedUserId = prefs.userId
                    val token = ++authAttemptToken
                    viewModelScope.launch {
                        _authLoading.value = true
                        try {
                            refreshCurrentProfile()
                        } finally {
                            if (token == authAttemptToken) _authLoading.value = false
                        }
                    }
                    refreshCloudContent()
                    runCatching { catalogRepository.syncCloudFavorites(prefs.userId) }.onFailure { _statusBanner.value = it.message }
                }
                if (prefs.languageCode != lastLoadedLang) {
                    lastLoadedLang = prefs.languageCode
                    refreshTmdbCatalog(languageCode = prefs.languageCode)
                }
            }
        }
    }

    suspend fun refreshCurrentProfile(): UserProfile? {
        repeat(3) { attempt ->
            val profile = runCatching { authRepository.refreshCurrentProfile() }.getOrNull()
            if (profile != null) {
                _currentProfile.value = profile
                lastLoadedUserId = preferences.value.userId.ifBlank { profile.id }
                return profile
            }
            if (attempt < 2) delay(300)
        }
        return null
    }

    suspend fun verifyAdminAccess(): Boolean {
        val profile = refreshCurrentProfile() ?: return false
        return profile.role == UserRole.ADMIN && !profile.isBanned
    }

    private fun adminDeniedError() = IllegalStateException(
        if (preferences.value.languageCode == "ar") "صلاحية المطور مطلوبة" else "Admin access required"
    )

    suspend fun refreshCloudContent(): Result<Unit> = sourcesRepository.refreshCloudContent()
        .onFailure { _statusBanner.value = it.message }

    fun clearBanner() { _statusBanner.value = null }

    fun clearTmdbStatusMessage() { _catalogState.update { it.copy(tmdbStatusMessage = null) } }

    private fun tmdbKey(): String = if (AppConfig.isTmdbConfigured) AppConfig.TMDB_API_KEY else ""

    fun refreshTmdbCatalog(apiKey: String = tmdbKey(), languageCode: String = preferences.value.languageCode) {
        if (!AppConfig.isTmdbConfigured || apiKey.isBlank()) return
        viewModelScope.launch {
            _catalogState.update { it.copy(isLoadingHome = true, tmdbStatusMessage = null) }
            val trending = catalogRepository.fetchTrending(apiKey, languageCode)
            val popMovies = catalogRepository.fetchPopularMovies(apiKey, languageCode, _catalogState.value.selectedMovieGenreId)
            val topMovies = catalogRepository.fetchTopRatedMovies(apiKey, languageCode)
            val popSeries = catalogRepository.fetchPopularSeries(apiKey, languageCode, _catalogState.value.selectedSeriesGenreId)
            val topSeries = catalogRepository.fetchTopRatedSeries(apiKey, languageCode)
            val movieGenres = catalogRepository.fetchMovieGenres(apiKey, languageCode)
            val seriesGenres = catalogRepository.fetchSeriesGenres(apiKey, languageCode)
            val errorMessage = listOf(trending, popMovies, topMovies, popSeries, topSeries)
                .mapNotNull { it.exceptionOrNull()?.message }
                .firstOrNull()
            _catalogState.update {
                it.copy(
                    isLoadingHome = false,
                    trending = trending.getOrDefault(emptyList()),
                    popularMovies = popMovies.getOrDefault(emptyList()),
                    topRatedMovies = topMovies.getOrDefault(emptyList()),
                    popularSeries = popSeries.getOrDefault(emptyList()),
                    topRatedSeries = topSeries.getOrDefault(emptyList()),
                    movieGenres = movieGenres,
                    seriesGenres = seriesGenres,
                    tmdbStatusMessage = errorMessage
                )
            }
        }
    }

    fun selectMovieGenre(genreId: Int?) {
        _catalogState.update { it.copy(selectedMovieGenreId = genreId) }
        if (!AppConfig.isTmdbConfigured) return
        viewModelScope.launch {
            val movies = catalogRepository.fetchPopularMovies(tmdbKey(), preferences.value.languageCode, genreId).getOrDefault(emptyList())
            _catalogState.update { it.copy(popularMovies = movies) }
        }
    }

    fun selectSeriesGenre(genreId: Int?) {
        _catalogState.update { it.copy(selectedSeriesGenreId = genreId) }
        if (!AppConfig.isTmdbConfigured) return
        viewModelScope.launch {
            val series = catalogRepository.fetchPopularSeries(tmdbKey(), preferences.value.languageCode, genreId).getOrDefault(emptyList())
            _catalogState.update { it.copy(popularSeries = series) }
        }
    }

    fun performSearch(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            _isSearching.value = true
            val results = catalogRepository.searchCatalog(tmdbKey(), preferences.value.languageCode, query)
            if (isActive) {
                _searchResults.value = results
                _isSearching.value = false
            }
        }
    }

    fun openMediaDetail(card: MediaCardItem) {
        val prefs = preferences.value
        viewModelScope.launch {
            _detailState.value = DetailUiState(isLoading = true)
            if (card.mediaType == MediaType.MOVIE) {
                val bundle = catalogRepository.getMovieDetails(tmdbKey(), prefs.languageCode, card.tmdbId, card)
                val resolved = sourcesRepository.resolvePlayback(MediaType.MOVIE, bundle.card.tmdbId, bundle.card.title, bundle.card.originalTitle, fallbackKey = bundle.card.mediaKey)
                val reactions = catalogRepository.fetchReactions(bundle.card.mediaKey)
                val comments = catalogRepository.fetchComments(bundle.card.mediaKey)
                _detailState.value = DetailUiState(isLoading = false, movieDetail = bundle, resolvedMoviePlayback = resolved, reactions = reactions, comments = comments)
            } else {
                val bundle = catalogRepository.getSeriesDetails(tmdbKey(), prefs.languageCode, card.tmdbId, card)
                val firstSeason = bundle.seasons.firstOrNull()?.seasonNumber ?: 1
                val reactions = catalogRepository.fetchReactions(bundle.card.mediaKey)
                val comments = catalogRepository.fetchComments(bundle.card.mediaKey)
                _detailState.value = DetailUiState(isLoading = false, seriesDetail = bundle, selectedSeason = firstSeason, isLoadingEpisodes = true, reactions = reactions, comments = comments)
                val episodes = catalogRepository.getSeasonEpisodes(tmdbKey(), prefs.languageCode, bundle.card, firstSeason)
                _detailState.update { it.copy(episodes = episodes, isLoadingEpisodes = false) }
            }
        }
    }

    fun refreshDetailSocial() {
        val card = _detailState.value.movieDetail?.card ?: _detailState.value.seriesDetail?.card ?: return
        viewModelScope.launch {
            _detailState.update { it.copy(reactions = catalogRepository.fetchReactions(card.mediaKey), comments = catalogRepository.fetchComments(card.mediaKey)) }
        }
    }

    fun toggleReaction(reactionType: String) {
        val card = _detailState.value.movieDetail?.card ?: _detailState.value.seriesDetail?.card ?: return
        viewModelScope.launch {
            val current = _detailState.value.reactions.myReaction
            val next = if (current == reactionType) null else reactionType
            catalogRepository.setReaction(card.mediaKey, next).onSuccess { state -> _detailState.update { it.copy(reactions = state) } }
                .onFailure { _statusBanner.value = it.message }
        }
    }

    fun postComment(content: String) {
        val card = _detailState.value.movieDetail?.card ?: _detailState.value.seriesDetail?.card ?: return
        viewModelScope.launch {
            catalogRepository.postComment(card.mediaKey, content).onSuccess {
                _detailState.update { it.copy(comments = catalogRepository.fetchComments(card.mediaKey)) }
            }.onFailure { _statusBanner.value = it.message }
        }
    }

    fun deleteComment(commentId: String) {
        viewModelScope.launch {
            catalogRepository.deleteComment(commentId).onSuccess { refreshDetailSocial() }.onFailure { _statusBanner.value = it.message }
        }
    }

    fun selectSeason(seasonNumber: Int) {
        val seriesCard = _detailState.value.seriesDetail?.card ?: return
        val prefs = preferences.value
        viewModelScope.launch {
            _detailState.update { it.copy(selectedSeason = seasonNumber, isLoadingEpisodes = true) }
            val episodes = catalogRepository.getSeasonEpisodes(tmdbKey(), prefs.languageCode, seriesCard, seasonNumber)
            _detailState.update { it.copy(episodes = episodes, isLoadingEpisodes = false) }
        }
    }

    fun saveManualLinkForMovie(card: MediaCardItem, streamUrl: String, subtitleUrl: String) {
        viewModelScope.launch {
            sourcesRepository.saveManualLinkOverride(MediaType.MOVIE, card.tmdbId, card.mediaKey, streamUrl = streamUrl, subtitleUrl = subtitleUrl)
            val resolved = sourcesRepository.resolvePlayback(MediaType.MOVIE, card.tmdbId, card.title, card.originalTitle, fallbackKey = card.mediaKey)
            _detailState.update { it.copy(resolvedMoviePlayback = resolved) }
        }
    }

    fun saveManualLinkForEpisode(seriesCard: MediaCardItem, seasonNumber: Int, episodeNumber: Int, streamUrl: String, subtitleUrl: String) {
        val prefs = preferences.value
        viewModelScope.launch {
            sourcesRepository.saveManualLinkOverride(MediaType.SERIES, seriesCard.tmdbId, seriesCard.mediaKey, seasonNumber, episodeNumber, streamUrl, subtitleUrl)
            val episodes = catalogRepository.getSeasonEpisodes(tmdbKey(), prefs.languageCode, seriesCard, seasonNumber)
            _detailState.update { it.copy(episodes = episodes) }
        }
    }

    suspend fun buildMoviePlayerRequest(card: MediaCardItem, resolved: ResolvedPlayback): PlayerLaunchRequest? {
        val streams = resolved.streams.ifEmpty { if (card.directStreamUrl.isNotBlank()) listOf(StreamQualityOption("Auto", card.directStreamUrl)) else emptyList() }
        if (streams.isEmpty()) return null
        val userId = _currentProfile.value?.id
        val progress = if (userId != null) catalogRepository.getWatchProgress(userId, card.mediaKey) else null
        return PlayerLaunchRequest(card.mediaKey, MediaType.MOVIE, card.title, card.year, card.posterUrl, card.tmdbId, streams, resolved.subtitles, progress?.positionMs ?: 0L)
    }

    suspend fun buildEpisodePlayerRequest(seriesCard: MediaCardItem, episode: EpisodeItem, allEpisodesInSeason: List<EpisodeItem>): PlayerLaunchRequest? {
        if (episode.resolvedStreams.isEmpty()) return null
        val epKey = "${seriesCard.mediaKey}_s${episode.seasonNumber}_e${episode.episodeNumber}"
        val userId = _currentProfile.value?.id
        val progress = if (userId != null) catalogRepository.getWatchProgress(userId, epKey) else null
        val queue = allEpisodesInSeason.mapNotNull { item ->
            val primary = item.resolvedStreams.firstOrNull()?.url ?: return@mapNotNull null
            PlayerEpisodeEntry(item.seasonNumber, item.episodeNumber, item.title, primary, item.resolvedStreams, item.resolvedSubtitles)
        }
        return PlayerLaunchRequest(epKey, MediaType.SERIES, seriesCard.title, "S${episode.seasonNumber} E${episode.episodeNumber} - ${episode.title}", episode.stillUrl.ifBlank { seriesCard.posterUrl }, seriesCard.tmdbId, episode.resolvedStreams, episode.resolvedSubtitles, progress?.positionMs ?: 0L, episode.seasonNumber, episode.episodeNumber, queue)
    }

    fun buildChannelPlayerRequest(channel: LiveChannelItem): PlayerLaunchRequest =
        PlayerLaunchRequest("live_${channel.id}_${channel.streamUrl.hashCode()}", MediaType.LIVE_TV, channel.name, channel.groupTitle, channel.logoUrl, streamOptions = listOf(StreamQualityOption("Live", channel.streamUrl)))

    @OptIn(ExperimentalCoroutinesApi::class)
    fun observeIsFavorite(mediaKey: String): Flow<Boolean> = _currentProfile.flatMapLatest { user -> if (user == null) flowOf(false) else catalogRepository.observeIsFavorite(user.id, mediaKey) }

    fun toggleFavorite(card: MediaCardItem, isFav: Boolean) {
        val userId = _currentProfile.value?.id ?: return
        viewModelScope.launch {
            runCatching { catalogRepository.toggleFavoriteCloud(userId, card, isFav) }
                .onFailure { _statusBanner.value = it.message }
        }
    }

    fun saveWatchProgress(request: PlayerLaunchRequest, activeStreamUrl: String, positionMs: Long, durationMs: Long) {
        val userId = _currentProfile.value?.id ?: return
        viewModelScope.launch { catalogRepository.saveWatchProgress(userId, request.mediaKey, request.mediaType, request.title, request.subtitle, request.posterUrl, activeStreamUrl, request.tmdbId, request.seasonNumber, request.episodeNumber, positionMs, durationMs) }
    }

    fun setLanguage(languageCode: String) { viewModelScope.launch { settingsDataStore.setLanguageCode(languageCode) } }
    fun updateSubtitleDefaults(fontSizeSp: Float, textColorArgb: Long, bgColorArgb: Long) { viewModelScope.launch { settingsDataStore.updateSubtitleStyle(fontSizeSp, textColorArgb, bgColorArgb) } }
    fun clearHistory() { val userId = _currentProfile.value?.id ?: return; viewModelScope.launch { catalogRepository.clearWatchHistory(userId); _statusBanner.value = if (preferences.value.languageCode == "ar") "تم مسح سجل المشاهدة" else "Watch history cleared" } }
    fun clearCache() { viewModelScope.launch { refreshCloudContent().onSuccess { _statusBanner.value = if (preferences.value.languageCode == "ar") "تم مسح الذاكرة المؤقتة وتحديث المحتوى" else "Cache cleared and content refreshed" } } }
    fun logout() { viewModelScope.launch { authRepository.signOut(); _currentProfile.value = null } }

    fun updateProfile(newName: String, newEmail: String?, newPhone: String?, avatarColor: Long, onResult: (AuthResult) -> Unit) {
        viewModelScope.launch {
            val res = authRepository.updateProfile(newName, newEmail, newPhone, avatarColor)
            if (res is AuthResult.Success) _currentProfile.value = res.profile
            onResult(res)
        }
    }

    // Admin
    private suspend fun requireAdmin(): Boolean {
        if (verifyAdminAccess()) return true
        val error = adminDeniedError()
        _statusBanner.value = error.message
        return false
    }

    fun adminSearchUsers(query: String, onResult: (Result<List<UserProfile>>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onResult(Result.failure(adminDeniedError())); return@launch }
            onResult(authRepository.adminSearchUsers(query))
        }
    }

    fun adminSetRole(userId: String, role: UserRole, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            onDone(authRepository.adminSetRole(userId, role))
        }
    }

    fun adminSetBanned(userId: String, banned: Boolean, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            onDone(authRepository.adminSetBanned(userId, banned))
        }
    }

    fun adminListCatalog(onResult: (Result<List<kotlinx.serialization.json.JsonObject>>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onResult(Result.failure(adminDeniedError())); return@launch }
            onResult(sourcesRepository.adminListCatalog())
        }
    }

    fun adminListEpisodes(onResult: (Result<List<kotlinx.serialization.json.JsonObject>>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onResult(Result.failure(adminDeniedError())); return@launch }
            onResult(sourcesRepository.adminListEpisodes())
        }
    }

    fun adminListChannels(onResult: (Result<List<kotlinx.serialization.json.JsonObject>>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onResult(Result.failure(adminDeniedError())); return@launch }
            onResult(sourcesRepository.adminListChannels())
        }
    }

    fun adminUpsertCatalog(payload: kotlinx.serialization.json.JsonObject, existingId: String?, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminUpsertCatalogItem(payload, existingId)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    fun adminDeleteCatalog(id: String, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminDeleteCatalogItem(id)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    fun adminUpsertEpisode(payload: kotlinx.serialization.json.JsonObject, existingId: String?, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminUpsertEpisode(payload, existingId)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    fun adminDeleteEpisode(id: String, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminDeleteEpisode(id)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    fun adminUpsertChannel(payload: kotlinx.serialization.json.JsonObject, existingId: String?, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminUpsertChannel(payload, existingId)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    fun adminDeleteChannel(id: String, onDone: (Result<Unit>) -> Unit) {
        viewModelScope.launch {
            if (!requireAdmin()) { onDone(Result.failure(adminDeniedError())); return@launch }
            val result = sourcesRepository.adminDeleteChannel(id)
            onDone(result)
            if (result.isSuccess) refreshCloudContent()
        }
    }

    // Legacy stubs to avoid compile errors in old UI refs; not exposed to users
    fun saveTmdbApiKey(apiKey: String) {}
    fun testTmdbKey(apiKey: String) {}
    fun addSource(name: String, type: SourceType, url: String) {}
    fun updateSource(source: SourceEntity, newName: String, newUrl: String) {}
    fun syncSource(source: SourceEntity) {}
    fun syncAllSources() {}
    fun toggleSource(source: SourceEntity, enabled: Boolean) {}
    fun deleteSource(sourceId: Long) {}

    class Factory(
        private val settingsDataStore: SettingsDataStore,
        private val authRepository: AuthRepository,
        private val sourcesRepository: SourcesRepository,
        private val catalogRepository: CatalogRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = CinemaViewModel(settingsDataStore, authRepository, sourcesRepository, catalogRepository) as T
    }
}
