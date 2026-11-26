package com.aluqabi.cinema.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.Link
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.aluqabi.cinema.domain.model.EpisodeItem
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.ResolvedPlayback
import com.aluqabi.cinema.ui.cinema.DetailUiState
import com.aluqabi.cinema.ui.components.RatingBadge
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaEmerald
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailsScreen(
    strings: AppStrings,
    detailState: DetailUiState,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onToggleFavorite: (MediaCardItem, Boolean) -> Unit,
    onSelectSeason: (Int) -> Unit,
    onPlayMovie: (MediaCardItem, ResolvedPlayback) -> Unit,
    onPlayEpisode: (MediaCardItem, EpisodeItem, List<EpisodeItem>) -> Unit,
    onSaveMovieLink: (MediaCardItem, String, String) -> Unit,
    onSaveEpisodeLink: (MediaCardItem, Int, Int, String, String) -> Unit
) {
    val card = detailState.movieDetail?.card ?: detailState.seriesDetail?.card
    var manualLinkDialogTarget by remember { mutableStateOf<EpisodeItem?>(null) }
    var showMovieLinkDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = CinemaBackground,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = card?.title ?: strings.appName,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
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
                actions = {
                    if (card != null) {
                        IconButton(onClick = { onToggleFavorite(card, isFavorite) }) {
                            Icon(
                                imageVector = if (isFavorite) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder,
                                contentDescription = strings.addToFavorites,
                                tint = if (isFavorite) CinemaRed else TextPrimary
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CinemaBackground)
            )
        }
    ) { padding ->
        if (detailState.isLoading || card == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = CinemaRed)
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(bottom = 28.dp)
        ) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(250.dp)
                        .background(CinemaSurfaceElevated)
                ) {
                    val backdrop = card.backdropUrl.ifBlank { card.posterUrl }
                    if (backdrop.isNotBlank()) {
                        AsyncImage(
                            model = backdrop,
                            contentDescription = card.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(
                                        Color.Transparent,
                                        CinemaBackground.copy(alpha = 0.6f),
                                        CinemaBackground
                                    )
                                )
                            )
                    )
                    Row(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(16.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        if (card.posterUrl.isNotBlank()) {
                            AsyncImage(
                                model = card.posterUrl,
                                contentDescription = card.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(92.dp)
                                    .height(136.dp)
                                    .clip(RoundedCornerShape(12.dp))
                            )
                            Spacer(Modifier.width(14.dp))
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = card.title,
                                color = TextPrimary,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                            Spacer(Modifier.height(6.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (card.rating > 0.0) {
                                    RatingBadge(rating = card.rating)
                                    Spacer(Modifier.width(8.dp))
                                }
                                if (card.year.isNotBlank()) {
                                    Text(card.year, color = TextSecondary, fontSize = 13.sp)
                                }
                                val runtime = detailState.movieDetail?.runtimeMinutes
                                if (runtime != null && runtime > 0) {
                                    Text(" • ${runtime}m", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                            val genres = detailState.movieDetail?.genres ?: detailState.seriesDetail?.genres ?: emptyList()
                            if (genres.isNotEmpty()) {
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    text = genres.joinToString(" • "),
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }

            if (card.overview.isNotBlank()) {
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                        Text(
                            text = strings.overview,
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = card.overview,
                            color = TextSecondary,
                            fontSize = 13.sp,
                            lineHeight = 20.sp
                        )
                    }
                }
            }

            if (card.mediaType == MediaType.MOVIE) {
                item {
                    val resolved = detailState.resolvedMoviePlayback
                    val hasPlayable = resolved.primaryUrl != null || card.directStreamUrl.isNotBlank()
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
                        border = BorderStroke(1.dp, CinemaSurfaceBorder),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = strings.playbackLinkTitle,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Spacer(Modifier.height(8.dp))
                            if (hasPlayable) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Rounded.CheckCircle,
                                        contentDescription = null,
                                        tint = CinemaEmerald,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        text = "${strings.matchedFromSource} ${resolved.sourceLabel ?: "Direct"}",
                                        color = CinemaEmerald,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                                Spacer(Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Button(
                                        onClick = { onPlayMovie(card, resolved) },
                                        colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Rounded.PlayArrow, contentDescription = null, tint = TextPrimary)
                                        Spacer(Modifier.width(6.dp))
                                        Text(strings.watchNow, color = TextPrimary, fontWeight = FontWeight.Bold)
                                    }
                                    OutlinedButton(
                                        onClick = { showMovieLinkDialog = true },
                                        border = BorderStroke(1.dp, CinemaSurfaceBorder),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Icon(Icons.Rounded.Edit, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                                    }
                                }
                            } else {
                                Text(
                                    text = strings.noStreamFound,
                                    color = TextSecondary,
                                    fontSize = 13.sp
                                )
                                Spacer(Modifier.height(12.dp))
                                Button(
                                    onClick = { showMovieLinkDialog = true },
                                    colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Rounded.Link, contentDescription = null, tint = TextPrimary)
                                    Spacer(Modifier.width(8.dp))
                                    Text(strings.editStreamLink, color = TextPrimary, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            } else {
                val seasons = detailState.seriesDetail?.seasons.orEmpty()
                if (seasons.isNotEmpty()) {
                    item {
                        Column(modifier = Modifier.padding(top = 8.dp)) {
                            Text(
                                text = strings.seasons,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                            )
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                items(seasons, key = { it.seasonNumber }) { season ->
                                    FilterChip(
                                        selected = detailState.selectedSeason == season.seasonNumber,
                                        onClick = { onSelectSeason(season.seasonNumber) },
                                        label = {
                                            Text(season.name.ifBlank { "${strings.seasonLabel} ${season.seasonNumber}" })
                                        },
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
                    }
                }

                if (detailState.isLoadingEpisodes) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = CinemaRed)
                        }
                    }
                } else {
                    items(detailState.episodes, key = { "${it.seasonNumber}_${it.episodeNumber}" }) { ep ->
                        val hasStream = ep.resolvedStreams.isNotEmpty()
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                                .clickable {
                                    if (hasStream) {
                                        onPlayEpisode(card, ep, detailState.episodes)
                                    } else {
                                        manualLinkDialogTarget = ep
                                    }
                                },
                            colors = CardDefaults.cardColors(containerColor = CinemaSurface),
                            border = BorderStroke(1.dp, CinemaSurfaceBorder),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .width(106.dp)
                                        .height(64.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(CinemaSurfaceElevated),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (ep.stillUrl.isNotBlank()) {
                                        AsyncImage(
                                            model = ep.stillUrl,
                                            contentDescription = ep.title,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    }
                                    Icon(
                                        imageVector = if (hasStream) Icons.Rounded.PlayArrow else Icons.Rounded.Link,
                                        contentDescription = null,
                                        tint = TextPrimary,
                                        modifier = Modifier
                                            .size(28.dp)
                                            .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
                                            .padding(4.dp)
                                    )
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${strings.episodeLabel} ${ep.episodeNumber}: ${ep.title}",
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (ep.overview.isNotBlank()) {
                                        Text(
                                            text = ep.overview,
                                            color = TextSecondary,
                                            fontSize = 12.sp,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                                IconButton(onClick = { manualLinkDialogTarget = ep }) {
                                    Icon(
                                        imageVector = Icons.Rounded.Edit,
                                        contentDescription = strings.editStreamLink,
                                        tint = if (hasStream) CinemaEmerald else TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showMovieLinkDialog && card != null) {
        ManualLinkDialog(
            strings = strings,
            initialUrl = detailState.resolvedMoviePlayback.primaryUrl ?: card.directStreamUrl,
            initialSub = detailState.resolvedMoviePlayback.subtitles.firstOrNull()?.url.orEmpty(),
            onDismiss = { showMovieLinkDialog = false },
            onSaveOnly = { url, sub ->
                onSaveMovieLink(card, url, sub)
                showMovieLinkDialog = false
            },
            onSaveAndPlay = { url, sub ->
                onSaveMovieLink(card, url, sub)
                showMovieLinkDialog = false
                onPlayMovie(
                    card,
                    ResolvedPlayback(
                        streams = listOf(com.aluqabi.cinema.domain.model.StreamQualityOption("Manual", url)),
                        subtitles = if (sub.isNotBlank()) {
                            listOf(com.aluqabi.cinema.domain.model.SubtitleTrackOption("External", "ar", sub))
                        } else {
                            emptyList()
                        }
                    )
                )
            }
        )
    }

    manualLinkDialogTarget?.let { targetEp ->
        if (card != null) {
            ManualLinkDialog(
                strings = strings,
                initialUrl = targetEp.resolvedStreams.firstOrNull()?.url.orEmpty(),
                initialSub = targetEp.resolvedSubtitles.firstOrNull()?.url.orEmpty(),
                onDismiss = { manualLinkDialogTarget = null },
                onSaveOnly = { url, sub ->
                    onSaveEpisodeLink(card, targetEp.seasonNumber, targetEp.episodeNumber, url, sub)
                    manualLinkDialogTarget = null
                },
                onSaveAndPlay = { url, sub ->
                    onSaveEpisodeLink(card, targetEp.seasonNumber, targetEp.episodeNumber, url, sub)
                    val updatedEp = targetEp.copy(
                        resolvedStreams = listOf(com.aluqabi.cinema.domain.model.StreamQualityOption("Manual", url)),
                        resolvedSubtitles = if (sub.isNotBlank()) {
                            listOf(com.aluqabi.cinema.domain.model.SubtitleTrackOption("External", "ar", sub))
                        } else {
                            emptyList()
                        }
                    )
                    manualLinkDialogTarget = null
                    onPlayEpisode(card, updatedEp, detailState.episodes)
                }
            )
        }
    }
}

@Composable
private fun ManualLinkDialog(
    strings: AppStrings,
    initialUrl: String,
    initialSub: String,
    onDismiss: () -> Unit,
    onSaveOnly: (String, String) -> Unit,
    onSaveAndPlay: (String, String) -> Unit
) {
    var streamUrl by remember { mutableStateOf(initialUrl) }
    var subtitleUrl by remember { mutableStateOf(initialSub) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text(strings.editStreamLink, color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = streamUrl,
                    onValueChange = { streamUrl = it },
                    label = { Text(strings.directStreamUrlHint, fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CinemaRed,
                        unfocusedBorderColor = CinemaSurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = subtitleUrl,
                    onValueChange = { subtitleUrl = it },
                    label = { Text(strings.subtitleUrlHint, fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CinemaRed,
                        unfocusedBorderColor = CinemaSurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (streamUrl.isNotBlank()) onSaveAndPlay(streamUrl.trim(), subtitleUrl.trim()) },
                enabled = streamUrl.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = CinemaRed)
            ) {
                Text(strings.saveAndPlay, color = TextPrimary)
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onDismiss) {
                    Text(strings.cancel, color = TextSecondary)
                }
                TextButton(
                    onClick = { if (streamUrl.isNotBlank()) onSaveOnly(streamUrl.trim(), subtitleUrl.trim()) },
                    enabled = streamUrl.isNotBlank()
                ) {
                    Text(strings.saveLinkOnly, color = CinemaRed)
                }
            }
        }
    )
}
