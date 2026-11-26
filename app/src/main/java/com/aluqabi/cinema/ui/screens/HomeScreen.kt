package com.aluqabi.cinema.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.ui.cinema.CatalogUiState
import com.aluqabi.cinema.ui.components.EmptyStateCard
import com.aluqabi.cinema.ui.components.HeroBannerCard
import com.aluqabi.cinema.ui.components.HorizontalMediaRow
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun HomeScreen(
    strings: AppStrings,
    hasTmdbKey: Boolean,
    catalogState: CatalogUiState,
    customItems: List<MediaCardItem>,
    watchHistory: List<WatchHistoryEntity>,
    onMediaClick: (MediaCardItem) -> Unit,
    onResumeHistory: (WatchHistoryEntity) -> Unit,
    onOpenSettings: () -> Unit
) {
    val heroItem = catalogState.trending.firstOrNull()
        ?: customItems.firstOrNull()
        ?: catalogState.popularMovies.firstOrNull()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(CinemaBackground),
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        if (catalogState.isLoadingHome) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = CinemaRed)
                }
            }
        }

        if (heroItem != null) {
            item {
                HeroBannerCard(
                    item = heroItem,
                    watchLabel = strings.watchNow,
                    onClick = { onMediaClick(heroItem) }
                )
            }
        } else if (!hasTmdbKey && customItems.isEmpty()) {
            item {
                EmptyStateCard(
                    icon = Icons.Rounded.Key,
                    title = strings.noTmdbKeyTitle,
                    description = strings.noTmdbKeyDesc,
                    actionLabel = strings.openSettings,
                    onAction = onOpenSettings
                )
            }
        }

        val vodHistory = watchHistory.filter { it.mediaType != MediaType.LIVE_TV.name }
        if (vodHistory.isNotEmpty()) {
            item {
                ContinueWatchingRow(
                    title = strings.continueWatching,
                    items = vodHistory,
                    onClick = onResumeHistory
                )
            }
        }

        if (customItems.isNotEmpty()) {
            item {
                HorizontalMediaRow(
                    title = strings.fromYourSources,
                    items = customItems,
                    onItemClick = onMediaClick
                )
            }
        }

        if (catalogState.trending.isNotEmpty()) {
            item {
                HorizontalMediaRow(
                    title = strings.trendingNow,
                    items = catalogState.trending,
                    onItemClick = onMediaClick
                )
            }
        }

        if (catalogState.popularMovies.isNotEmpty()) {
            item {
                HorizontalMediaRow(
                    title = strings.popularMovies,
                    items = catalogState.popularMovies,
                    onItemClick = onMediaClick
                )
            }
        }

        if (catalogState.popularSeries.isNotEmpty()) {
            item {
                HorizontalMediaRow(
                    title = strings.popularSeries,
                    items = catalogState.popularSeries,
                    onItemClick = onMediaClick
                )
            }
        }
    }
}

@Composable
private fun ContinueWatchingRow(
    title: String,
    items: List<WatchHistoryEntity>,
    onClick: (WatchHistoryEntity) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(items, key = { it.recordKey }) { item ->
                Column(
                    modifier = Modifier
                        .width(170.dp)
                        .clickable { onClick(item) }
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(98.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(CinemaSurfaceElevated)
                    ) {
                        if (item.posterUrl.isNotBlank()) {
                            AsyncImage(
                                model = item.posterUrl,
                                contentDescription = item.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .align(Alignment.Center)
                                .background(Color.Black.copy(alpha = 0.72f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.PlayArrow,
                                contentDescription = null,
                                tint = TextPrimary,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        val progress = if (item.durationMs > 0L) {
                            (item.positionMs.toFloat() / item.durationMs.toFloat()).coerceIn(0f, 1f)
                        } else {
                            0f
                        }
                        LinearProgressIndicator(
                            progress = { progress },
                            color = CinemaRed,
                            trackColor = Color.White.copy(alpha = 0.25f),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(3.dp)
                                .align(Alignment.BottomCenter)
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = item.title,
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (item.subtitle.isNotBlank()) {
                        Text(
                            text = item.subtitle,
                            color = TextSecondary,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
