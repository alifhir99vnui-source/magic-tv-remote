package com.aluqabi.cinema.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aluqabi.cinema.data.remote.model.TmdbGenreDto
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.ui.cinema.CatalogUiState
import com.aluqabi.cinema.ui.components.EmptyStateCard
import com.aluqabi.cinema.ui.components.MediaPosterGrid
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun MoviesScreen(
    strings: AppStrings,
    hasTmdbKey: Boolean,
    catalogState: CatalogUiState,
    customItems: List<MediaCardItem>,
    onSelectGenre: (Int?) -> Unit,
    onMediaClick: (MediaCardItem) -> Unit,
    onOpenSettings: () -> Unit
) {
    val customMovies = remember(customItems) {
        customItems.filter { it.mediaType == MediaType.MOVIE }
    }
    val combined = remember(catalogState.popularMovies, catalogState.topRatedMovies, customMovies, catalogState.selectedMovieGenreId) {
        if (catalogState.selectedMovieGenreId != null) {
            catalogState.popularMovies
        } else {
            (customMovies + catalogState.popularMovies + catalogState.topRatedMovies).distinctBy { it.mediaKey }
        }
    }

    CatalogTabContent(
        strings = strings,
        hasTmdbKey = hasTmdbKey,
        genres = catalogState.movieGenres,
        selectedGenreId = catalogState.selectedMovieGenreId,
        items = combined,
        onSelectGenre = onSelectGenre,
        onMediaClick = onMediaClick,
        onOpenSettings = onOpenSettings
    )
}

@Composable
fun SeriesScreen(
    strings: AppStrings,
    hasTmdbKey: Boolean,
    catalogState: CatalogUiState,
    customItems: List<MediaCardItem>,
    onSelectGenre: (Int?) -> Unit,
    onMediaClick: (MediaCardItem) -> Unit,
    onOpenSettings: () -> Unit
) {
    val customSeries = remember(customItems) {
        customItems.filter { it.mediaType == MediaType.SERIES }
    }
    val combined = remember(catalogState.popularSeries, catalogState.topRatedSeries, customSeries, catalogState.selectedSeriesGenreId) {
        if (catalogState.selectedSeriesGenreId != null) {
            catalogState.popularSeries
        } else {
            (customSeries + catalogState.popularSeries + catalogState.topRatedSeries).distinctBy { it.mediaKey }
        }
    }

    CatalogTabContent(
        strings = strings,
        hasTmdbKey = hasTmdbKey,
        genres = catalogState.seriesGenres,
        selectedGenreId = catalogState.selectedSeriesGenreId,
        items = combined,
        onSelectGenre = onSelectGenre,
        onMediaClick = onMediaClick,
        onOpenSettings = onOpenSettings
    )
}

@Composable
private fun CatalogTabContent(
    strings: AppStrings,
    hasTmdbKey: Boolean,
    genres: List<TmdbGenreDto>,
    selectedGenreId: Int?,
    items: List<MediaCardItem>,
    onSelectGenre: (Int?) -> Unit,
    onMediaClick: (MediaCardItem) -> Unit,
    onOpenSettings: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(CinemaBackground)
    ) {
        if (genres.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    FilterChip(
                        selected = selectedGenreId == null,
                        onClick = { onSelectGenre(null) },
                        label = { Text(strings.allGenres) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CinemaRed,
                            selectedLabelColor = TextPrimary,
                            containerColor = CinemaSurfaceElevated,
                            labelColor = TextSecondary
                        )
                    )
                }
                items(genres, key = { it.id }) { genre ->
                    FilterChip(
                        selected = selectedGenreId == genre.id,
                        onClick = { onSelectGenre(genre.id) },
                        label = { Text(genre.name) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CinemaRed,
                            selectedLabelColor = TextPrimary,
                            containerColor = CinemaSurfaceElevated,
                            labelColor = TextSecondary
                        )
                    )
                }
            }
        }

        if (items.isEmpty()) {
            EmptyStateCard(
                icon = Icons.Rounded.Key,
                title = if (hasTmdbKey) strings.searchNoResults else strings.noTmdbKeyTitle,
                description = strings.noTmdbKeyDesc,
                actionLabel = strings.openSettings,
                onAction = onOpenSettings
            )
        } else {
            MediaPosterGrid(
                items = items,
                onItemClick = onMediaClick,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    strings: AppStrings,
    results: List<MediaCardItem>,
    isSearching: Boolean,
    onQueryChange: (String) -> Unit,
    onMediaClick: (MediaCardItem) -> Unit,
    onBack: () -> Unit
) {
    var query by remember { mutableStateOf("") }

    Scaffold(
        containerColor = CinemaBackground,
        topBar = {
            TopAppBar(
                title = {
                    OutlinedTextField(
                        value = query,
                        onValueChange = {
                            query = it
                            onQueryChange(it)
                        },
                        placeholder = { Text(strings.searchHint, fontSize = 13.sp) },
                        singleLine = true,
                        leadingIcon = {
                            Icon(Icons.Rounded.Search, contentDescription = null, tint = TextSecondary)
                        },
                        trailingIcon = {
                            if (query.isNotEmpty()) {
                                IconButton(onClick = {
                                    query = ""
                                    onQueryChange("")
                                }) {
                                    Icon(Icons.Rounded.Close, contentDescription = null, tint = TextSecondary)
                                }
                            }
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CinemaRed,
                            unfocusedBorderColor = CinemaSurfaceBorder,
                            focusedContainerColor = CinemaSurfaceElevated,
                            unfocusedContainerColor = CinemaSurfaceElevated,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CinemaBackground)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isSearching -> {
                    CircularProgressIndicator(
                        color = CinemaRed,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                query.isBlank() -> {
                    EmptyStateCard(
                        icon = Icons.Rounded.Search,
                        title = strings.searchHint,
                        description = strings.searchEmpty
                    )
                }
                results.isEmpty() -> {
                    EmptyStateCard(
                        icon = Icons.Rounded.Movie,
                        title = strings.searchNoResults,
                        description = query
                    )
                }
                else -> {
                    MediaPosterGrid(
                        items = results,
                        onItemClick = onMediaClick,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}
