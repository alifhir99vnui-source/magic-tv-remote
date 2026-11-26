package com.aluqabi.cinema

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Bundle
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.PlayerLaunchRequest
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.ui.auth.AuthScreen
import com.aluqabi.cinema.ui.auth.AuthViewModel
import com.aluqabi.cinema.ui.cinema.CinemaViewModel
import com.aluqabi.cinema.ui.components.CinemaTopBar
import com.aluqabi.cinema.ui.i18n.stringsFor
import com.aluqabi.cinema.ui.player.NetflixPlayerScreen
import com.aluqabi.cinema.ui.screens.DetailsScreen
import com.aluqabi.cinema.ui.screens.HomeScreen
import com.aluqabi.cinema.ui.screens.LiveTvScreen
import com.aluqabi.cinema.ui.screens.MoviesScreen
import com.aluqabi.cinema.ui.screens.ProfileScreen
import com.aluqabi.cinema.ui.screens.SearchScreen
import com.aluqabi.cinema.ui.screens.SeriesScreen
import com.aluqabi.cinema.ui.screens.SettingsScreen
import com.aluqabi.cinema.ui.theme.AlUqabiCinemaTheme
import com.aluqabi.cinema.config.AppConfig
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary
import kotlinx.coroutines.launch

private enum class BottomTab {
    HOME,
    MOVIES,
    SERIES,
    LIVE_TV,
    SETTINGS
}

private enum class SubRoute {
    NONE,
    PROFILE,
    SEARCH,
    DETAILS
}

class MainActivity : ComponentActivity() {

    private var isPlayerActive by mutableStateOf(false)
    private var isInPipMode by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as AlUqabiCinemaApp).container

        setContent {
            val authViewModel: AuthViewModel = viewModel(
                factory = AuthViewModel.Factory(container.authRepository)
            )
            val cinemaViewModel: CinemaViewModel = viewModel(
                factory = CinemaViewModel.Factory(
                    settingsDataStore = container.settingsDataStore,
                    authRepository = container.authRepository,
                    sourcesRepository = container.sourcesRepository,
                    catalogRepository = container.catalogRepository
                )
            )

            val preferences by cinemaViewModel.preferences.collectAsStateWithLifecycle()
            val currentUser by cinemaViewModel.currentUser.collectAsStateWithLifecycle()
            val strings = remember(preferences.languageCode) {
                stringsFor(preferences.languageCode)
            }
            val layoutDirection = if (strings.isArabic) LayoutDirection.Rtl else LayoutDirection.Ltr

            AlUqabiCinemaTheme {
                CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                    if (currentUser == null) {
                        AuthScreen(
                            viewModel = authViewModel,
                            strings = strings,
                            onToggleLanguage = {
                                val nextLang = if (preferences.languageCode == "ar") "en" else "ar"
                                cinemaViewModel.setLanguage(nextLang)
                            }
                        )
                    } else {
                        MainCinemaApp(
                            cinemaViewModel = cinemaViewModel,
                            okHttpClient = container.okHttpClient,
                            strings = strings,
                            user = currentUser!!,
                            isInPipMode = isInPipMode,
                            onPlayerActiveChanged = { active -> isPlayerActive = active },
                            onEnterPip = { enterPlayerPipMode() }
                        )
                    }
                }
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isPlayerActive) {
            enterPlayerPipMode()
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        isInPipMode = isInPictureInPictureMode
    }

    private fun enterPlayerPipMode() {
        runCatching {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        }
    }
}

@Composable
private fun MainCinemaApp(
    cinemaViewModel: CinemaViewModel,
    okHttpClient: okhttp3.OkHttpClient,
    strings: com.aluqabi.cinema.ui.i18n.AppStrings,
    user: com.aluqabi.cinema.data.local.entity.UserEntity,
    isInPipMode: Boolean,
    onPlayerActiveChanged: (Boolean) -> Unit,
    onEnterPip: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val preferences by cinemaViewModel.preferences.collectAsStateWithLifecycle()
    val catalogState by cinemaViewModel.catalogState.collectAsStateWithLifecycle()
    val detailState by cinemaViewModel.detailState.collectAsStateWithLifecycle()
    val sources by cinemaViewModel.sources.collectAsStateWithLifecycle()
    val liveChannels by cinemaViewModel.liveChannels.collectAsStateWithLifecycle()
    val customItems by cinemaViewModel.customMediaCards.collectAsStateWithLifecycle()
    val favorites by cinemaViewModel.favorites.collectAsStateWithLifecycle()
    val watchHistory by cinemaViewModel.watchHistory.collectAsStateWithLifecycle()
    val searchResults by cinemaViewModel.searchResults.collectAsStateWithLifecycle()
    val isSearching by cinemaViewModel.isSearching.collectAsStateWithLifecycle()
    val statusBanner by cinemaViewModel.statusBanner.collectAsStateWithLifecycle()

    var currentTab by remember { mutableStateOf(BottomTab.HOME) }
    var subRoute by remember { mutableStateOf(SubRoute.NONE) }
    var selectedDetailCard by remember { mutableStateOf<MediaCardItem?>(null) }
    var activePlayerRequest by remember { mutableStateOf<PlayerLaunchRequest?>(null) }

    onPlayerActiveChanged(activePlayerRequest != null)

    fun openDetails(card: MediaCardItem) {
        selectedDetailCard = card
        cinemaViewModel.openMediaDetail(card)
        subRoute = SubRoute.DETAILS
    }

    fun resumeFromHistory(item: WatchHistoryEntity) {
        val type = runCatching { MediaType.valueOf(item.mediaType) }.getOrDefault(MediaType.MOVIE)
        activePlayerRequest = PlayerLaunchRequest(
            mediaKey = item.mediaKey,
            mediaType = type,
            title = item.title,
            subtitle = item.subtitle,
            posterUrl = item.posterUrl,
            tmdbId = item.tmdbId,
            streamOptions = listOf(StreamQualityOption("Resume", item.streamUrl)),
            initialPositionMs = item.positionMs,
            seasonNumber = item.seasonNumber,
            episodeNumber = item.episodeNumber
        )
    }

    if (activePlayerRequest != null) {
        NetflixPlayerScreen(
            request = activePlayerRequest!!,
            strings = strings,
            preferences = preferences,
            okHttpClient = okHttpClient,
            isInPipMode = isInPipMode,
            onEnterPip = onEnterPip,
            onSaveProgress = { req, url, pos, dur ->
                cinemaViewModel.saveWatchProgress(req, url, pos, dur)
            },
            onUpdateSubtitlePrefs = { size, textHex, bgHex ->
                cinemaViewModel.updateSubtitleDefaults(size, textHex, bgHex)
            },
            onClose = { activePlayerRequest = null }
        )
        return
    }

    if (subRoute != SubRoute.NONE) {
        BackHandler { subRoute = SubRoute.NONE }
    }

    when (subRoute) {
        SubRoute.PROFILE -> {
            ProfileScreen(
                strings = strings,
                user = user,
                favorites = favorites,
                history = watchHistory,
                onBack = { subRoute = SubRoute.NONE },
                onFavoriteClick = { card -> openDetails(card) },
                onHistoryClick = { hist -> resumeFromHistory(hist) },
                onUpdateProfile = { name, email, phone, color, cb ->
                    cinemaViewModel.updateProfile(name, email, phone, color, cb)
                },
                onLogout = {
                    subRoute = SubRoute.NONE
                    cinemaViewModel.logout()
                }
            )
        }

        SubRoute.SEARCH -> {
            SearchScreen(
                strings = strings,
                results = searchResults,
                isSearching = isSearching,
                onQueryChange = cinemaViewModel::performSearch,
                onMediaClick = { card -> openDetails(card) },
                onBack = { subRoute = SubRoute.NONE }
            )
        }

        SubRoute.DETAILS -> {
            val activeCard = detailState.movieDetail?.card ?: detailState.seriesDetail?.card ?: selectedDetailCard
            val favFlow = remember(activeCard?.mediaKey) {
                activeCard?.let { cinemaViewModel.observeIsFavorite(it.mediaKey) }
                    ?: kotlinx.coroutines.flow.flowOf(false)
            }
            val isFav by favFlow.collectAsStateWithLifecycle(initialValue = false)

            DetailsScreen(
                strings = strings,
                detailState = detailState,
                isFavorite = isFav,
                onBack = { subRoute = SubRoute.NONE },
                onToggleFavorite = cinemaViewModel::toggleFavorite,
                onSelectSeason = cinemaViewModel::selectSeason,
                onPlayMovie = { card, resolved ->
                    scope.launch {
                        activePlayerRequest = cinemaViewModel.buildMoviePlayerRequest(card, resolved)
                    }
                },
                onPlayEpisode = { card, ep, allEps ->
                    scope.launch {
                        activePlayerRequest = cinemaViewModel.buildEpisodePlayerRequest(card, ep, allEps)
                    }
                },
                onSaveMovieLink = cinemaViewModel::saveManualLinkForMovie,
                onSaveEpisodeLink = cinemaViewModel::saveManualLinkForEpisode
            )
        }

        SubRoute.NONE -> {
            Scaffold(
                containerColor = CinemaBackground,
                topBar = {
                    CinemaTopBar(
                        title = strings.appName,
                        onOpenProfile = { subRoute = SubRoute.PROFILE },
                        onOpenSearch = { subRoute = SubRoute.SEARCH }
                    )
                },
                bottomBar = {
                    NavigationBar(containerColor = CinemaSurface) {
                        val tabs = listOf(
                            Triple(BottomTab.HOME, Icons.Rounded.Home, strings.navHome),
                            Triple(BottomTab.MOVIES, Icons.Rounded.Movie, strings.navMovies),
                            Triple(BottomTab.SERIES, Icons.Rounded.Tv, strings.navSeries),
                            Triple(BottomTab.LIVE_TV, Icons.Rounded.LiveTv, strings.navLiveTv),
                            Triple(BottomTab.SETTINGS, Icons.Rounded.Settings, strings.navSettings)
                        )
                        tabs.forEach { (tab, icon, label) ->
                            NavigationBarItem(
                                selected = currentTab == tab,
                                onClick = { currentTab = tab },
                                icon = { Icon(imageVector = icon, contentDescription = label) },
                                label = {
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = if (currentTab == tab) FontWeight.Bold else FontWeight.Normal,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = CinemaRed,
                                    selectedTextColor = TextPrimary,
                                    unselectedIconColor = TextSecondary,
                                    unselectedTextColor = TextSecondary,
                                    indicatorColor = CinemaRed.copy(alpha = 0.14f)
                                )
                            )
                        }
                    }
                }
            ) { innerPadding ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    val hasTmdbKey = AppConfig.isTmdbConfigured || preferences.tmdbApiKey.isNotBlank()
                    when (currentTab) {
                        BottomTab.HOME -> HomeScreen(
                            strings = strings,
                            hasTmdbKey = hasTmdbKey,
                            catalogState = catalogState,
                            customItems = customItems,
                            watchHistory = watchHistory,
                            onMediaClick = ::openDetails,
                            onResumeHistory = ::resumeFromHistory,
                            onOpenSettings = { currentTab = BottomTab.SETTINGS }
                        )

                        BottomTab.MOVIES -> MoviesScreen(
                            strings = strings,
                            hasTmdbKey = hasTmdbKey,
                            catalogState = catalogState,
                            customItems = customItems,
                            onSelectGenre = cinemaViewModel::selectMovieGenre,
                            onMediaClick = ::openDetails,
                            onOpenSettings = { currentTab = BottomTab.SETTINGS }
                        )

                        BottomTab.SERIES -> SeriesScreen(
                            strings = strings,
                            hasTmdbKey = hasTmdbKey,
                            catalogState = catalogState,
                            customItems = customItems,
                            onSelectGenre = cinemaViewModel::selectSeriesGenre,
                            onMediaClick = ::openDetails,
                            onOpenSettings = { currentTab = BottomTab.SETTINGS }
                        )

                        BottomTab.LIVE_TV -> LiveTvScreen(
                            strings = strings,
                            channels = liveChannels,
                            onChannelClick = { ch ->
                                activePlayerRequest = cinemaViewModel.buildChannelPlayerRequest(ch)
                            },
                            onOpenSettings = { currentTab = BottomTab.SETTINGS }
                        )

                        BottomTab.SETTINGS -> SettingsScreen(
                            strings = strings,
                            preferences = preferences,
                            onUpdateSubtitleDefaults = cinemaViewModel::updateSubtitleDefaults,
                            onSetLanguage = cinemaViewModel::setLanguage,
                            onClearHistory = cinemaViewModel::clearHistory
                        )
                    }
                }
            }
        }
    }
}
