package com.aluqabi.cinema.ui.player

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aluqabi.cinema.domain.model.PlayerEpisodeEntry
import com.aluqabi.cinema.domain.model.SubtitleTrackOption
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun PlayerOverlaySheetContainer(
    title: String,
    onClose: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = 0.6f))
            .clickable(onClick = onClose)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CinemaSurface.copy(alpha = 0.96f)),
            border = BorderStroke(1.dp, CinemaSurfaceBorder),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .heightIn(max = 360.dp)
                .clickable(enabled = false) {}
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = title,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    IconButton(onClick = onClose, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Rounded.Close, contentDescription = null, tint = TextSecondary)
                    }
                }
                HorizontalDivider(color = CinemaSurfaceBorder, modifier = Modifier.padding(vertical = 8.dp))
                content()
            }
        }
    }
}

@Composable
fun QualityAndAudioSheet(
    strings: AppStrings,
    qualities: List<VideoQualityTrack>,
    isAutoQuality: Boolean,
    audioTracks: List<AudioTrackItem>,
    onSelectAutoQuality: () -> Unit,
    onSelectQuality: (VideoQualityTrack) -> Unit,
    onSelectAudio: (AudioTrackItem) -> Unit,
    onClose: () -> Unit
) {
    PlayerOverlaySheetContainer(
        title = "${strings.qualityTitle} / ${strings.audioTrackTitle}",
        onClose = onClose
    ) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item {
                Text(
                    text = strings.qualityTitle,
                    color = CinemaRed,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            item {
                SelectableRow(
                    label = strings.autoQuality,
                    selected = isAutoQuality,
                    onClick = onSelectAutoQuality
                )
            }
            items(qualities, key = { it.id }) { track ->
                SelectableRow(
                    label = track.label,
                    selected = !isAutoQuality && track.isSelected,
                    onClick = { onSelectQuality(track) }
                )
            }

            if (audioTracks.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = strings.audioTrackTitle,
                        color = CinemaRed,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                items(audioTracks, key = { it.id }) { audio ->
                    SelectableRow(
                        label = audio.label,
                        selected = audio.isSelected,
                        onClick = { onSelectAudio(audio) }
                    )
                }
            }
        }
    }
}

@Composable
fun SubtitlesManagerSheet(
    strings: AppStrings,
    embeddedSubtitles: List<EmbeddedSubtitleTrack>,
    externalSubtitles: List<SubtitleTrackOption>,
    selectedSubtitleId: String?,
    fontSizeSp: Float,
    textColorArgb: Long,
    bgColorArgb: Long,
    syncOffsetMs: Long,
    onSelectOff: () -> Unit,
    onSelectEmbedded: (EmbeddedSubtitleTrack) -> Unit,
    onSelectExternal: (SubtitleTrackOption) -> Unit,
    onPickLocalSubtitleFile: () -> Unit,
    onLoadSubtitleUrl: (String) -> Unit,
    onFontSizeChange: (Float) -> Unit,
    onTextColorChange: (Long) -> Unit,
    onBgColorChange: (Long) -> Unit,
    onSyncOffsetChange: (Long) -> Unit,
    onClose: () -> Unit
) {
    var urlInput by remember { mutableStateOf("") }

    PlayerOverlaySheetContainer(
        title = strings.subtitlesTitle,
        onClose = onClose
    ) {
        Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
            SelectableRow(
                label = strings.subtitlesOff,
                selected = selectedSubtitleId == null,
                onClick = onSelectOff
            )

            externalSubtitles.forEach { ext ->
                SelectableRow(
                    label = ext.label,
                    selected = selectedSubtitleId == "ext_${ext.url}",
                    onClick = { onSelectExternal(ext) }
                )
            }

            embeddedSubtitles.forEach { emb ->
                SelectableRow(
                    label = emb.label,
                    selected = selectedSubtitleId == emb.id,
                    onClick = { onSelectEmbedded(emb) }
                )
            }

            Spacer(Modifier.height(10.dp))

            OutlinedButton(
                onClick = onPickLocalSubtitleFile,
                border = BorderStroke(1.dp, CinemaSurfaceBorder),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Rounded.FolderOpen, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(strings.loadSrtFromDevice, color = TextPrimary, fontSize = 13.sp)
            }

            Spacer(Modifier.height(8.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    placeholder = { Text(strings.loadSrtFromUrl, fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CinemaRed,
                        unfocusedBorderColor = CinemaSurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = {
                        if (urlInput.isNotBlank()) {
                            onLoadSubtitleUrl(urlInput.trim())
                            urlInput = ""
                        }
                    },
                    enabled = urlInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(strings.add, color = TextPrimary, fontSize = 12.sp)
                }
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = "${strings.fontSizeLabel}: ${fontSizeSp.toInt()} sp",
                color = TextSecondary,
                fontSize = 12.sp
            )
            Slider(
                value = fontSizeSp,
                onValueChange = onFontSizeChange,
                valueRange = 12f..32f,
                colors = SliderDefaults.colors(thumbColor = CinemaRed, activeTrackColor = CinemaRed)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(strings.textColorLabel, color = TextSecondary, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0xFFFFFFFFL, 0xFFFFEB3BL, 0xFF38BDF8L, 0xFF4ADE80L).forEach { hex ->
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(Color(hex))
                                    .then(
                                        if (textColorArgb == hex) Modifier.border(2.dp, CinemaRed, CircleShape)
                                        else Modifier
                                    )
                                    .clickable { onTextColorChange(hex) }
                            )
                        }
                    }
                }
                Column {
                    Text(strings.bgColorLabel, color = TextSecondary, fontSize = 11.sp)
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(0x00000000L, 0x77000000L, 0xCC000000L, 0xAA1E293BL).forEach { hex ->
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(Color(hex))
                                    .border(
                                        width = if (bgColorArgb == hex) 2.dp else 1.dp,
                                        color = if (bgColorArgb == hex) CinemaRed else CinemaSurfaceBorder,
                                        shape = CircleShape
                                    )
                                    .clickable { onBgColorChange(hex) }
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${strings.syncOffsetLabel}: ${if (syncOffsetMs > 0) "+$syncOffsetMs" else syncOffsetMs} ms",
                    color = TextSecondary,
                    fontSize = 12.sp
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    IconButton(
                        onClick = { onSyncOffsetChange((syncOffsetMs - 250L).coerceAtLeast(-5000L)) },
                        modifier = Modifier
                            .size(32.dp)
                            .background(CinemaSurfaceElevated, CircleShape)
                    ) {
                        Icon(Icons.Rounded.Remove, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                    }
                    IconButton(
                        onClick = { onSyncOffsetChange((syncOffsetMs + 250L).coerceAtMost(5000L)) },
                        modifier = Modifier
                            .size(32.dp)
                            .background(CinemaSurfaceElevated, CircleShape)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun PlaybackSpeedSheet(
    strings: AppStrings,
    currentSpeed: Float,
    onSelectSpeed: (Float) -> Unit,
    onClose: () -> Unit
) {
    val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
    PlayerOverlaySheetContainer(title = strings.speedTitle, onClose = onClose) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            speeds.forEach { spd ->
                SelectableRow(
                    label = "${spd}x",
                    selected = currentSpeed == spd,
                    onClick = {
                        onSelectSpeed(spd)
                        onClose()
                    }
                )
            }
        }
    }
}

@Composable
fun InPlayerEpisodesSheet(
    strings: AppStrings,
    episodes: List<PlayerEpisodeEntry>,
    currentEpisodeNumber: Int?,
    onSelectEpisode: (PlayerEpisodeEntry) -> Unit,
    onClose: () -> Unit
) {
    PlayerOverlaySheetContainer(title = strings.episodesTitle, onClose = onClose) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(episodes, key = { "${it.seasonNumber}_${it.episodeNumber}" }) { ep ->
                val isCurrent = ep.episodeNumber == currentEpisodeNumber
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isCurrent) CinemaRed.copy(alpha = 0.2f) else CinemaSurfaceElevated)
                        .clickable {
                            onSelectEpisode(ep)
                            onClose()
                        }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.PlayArrow,
                        contentDescription = null,
                        tint = if (isCurrent) CinemaRed else TextSecondary
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "${strings.episodeLabel} ${ep.episodeNumber}: ${ep.title}",
                        color = TextPrimary,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun SelectableRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) CinemaRed.copy(alpha = 0.2f) else CinemaSurfaceElevated)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            color = TextPrimary,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        if (selected) {
            Icon(
                imageVector = Icons.Rounded.Check,
                contentDescription = null,
                tint = CinemaRed,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
