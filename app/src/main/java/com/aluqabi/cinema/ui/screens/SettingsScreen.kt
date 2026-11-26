package com.aluqabi.cinema.ui.screens

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aluqabi.cinema.data.local.AppPreferences
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.domain.model.SourceType
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaEmerald
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextMuted
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun SettingsScreen(
    strings: AppStrings,
    preferences: AppPreferences,
    sources: List<SourceEntity>,
    statusBanner: String?,
    onDismissBanner: () -> Unit,
    onSaveTmdbKey: (String) -> Unit,
    onTestTmdbKey: (String) -> Unit,
    onAddSource: (String, SourceType, String) -> Unit,
    onUpdateSource: (SourceEntity, String, String) -> Unit,
    onToggleSource: (SourceEntity, Boolean) -> Unit,
    onSyncSource: (SourceEntity) -> Unit,
    onSyncAllSources: () -> Unit,
    onDeleteSource: (Long) -> Unit,
    onUpdateSubtitleDefaults: (Float, Long, Long) -> Unit,
    onSetLanguage: (String) -> Unit,
    onClearHistory: () -> Unit
) {
    var apiKeyInput by remember(preferences.tmdbApiKey) { mutableStateOf(preferences.tmdbApiKey) }
    var showAddSourceDialog by remember { mutableStateOf(false) }
    var editingSource by remember { mutableStateOf<SourceEntity?>(null) }

    var fontSize by remember(preferences.subtitleFontSizeSp) { mutableFloatStateOf(preferences.subtitleFontSizeSp) }
    var textColor by remember(preferences.subtitleTextColorArgb) { mutableLongStateOf(preferences.subtitleTextColorArgb) }
    var bgColor by remember(preferences.subtitleBgColorArgb) { mutableLongStateOf(preferences.subtitleBgColorArgb) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(CinemaBackground),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (!statusBanner.isNullOrBlank()) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = CinemaSurfaceElevated),
                    border = BorderStroke(1.dp, CinemaEmerald.copy(alpha = 0.6f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onDismissBanner() }
                ) {
                    Text(
                        text = statusBanner,
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }
        }

        // 1. TMDB API Section
        item {
            SettingsCard(title = strings.tmdbSectionTitle) {
                OutlinedTextField(
                    value = apiKeyInput,
                    onValueChange = { apiKeyInput = it },
                    label = { Text(strings.tmdbKeyLabel, fontSize = 12.sp) },
                    singleLine = true,
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
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { onSaveTmdbKey(apiKeyInput) },
                        colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(strings.saveKey, color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    OutlinedButton(
                        onClick = { onTestTmdbKey(apiKeyInput) },
                        enabled = apiKeyInput.isNotBlank(),
                        border = BorderStroke(1.dp, CinemaSurfaceBorder),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(strings.testConnection, color = TextPrimary)
                    }
                }
            }
        }

        // 2. Sources Manager Header
        item {
            SettingsCard(title = strings.sourcesSectionTitle) {
                Text(
                    text = strings.jsonSchemaHint,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { showAddSourceDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(strings.addSource, color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    if (sources.isNotEmpty()) {
                        OutlinedButton(
                            onClick = onSyncAllSources,
                            border = BorderStroke(1.dp, CinemaSurfaceBorder),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Rounded.Refresh, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(strings.syncAll, color = TextPrimary)
                        }
                    }
                }
            }
        }

        items(sources, key = { it.id }) { source ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CinemaSurface),
                border = BorderStroke(1.dp, CinemaSurfaceBorder),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = source.name,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "${source.type} • ${source.itemCount} ${strings.itemsCountLabel}",
                                color = TextSecondary,
                                fontSize = 12.sp
                            )
                            Text(
                                text = source.url,
                                color = TextMuted,
                                fontSize = 11.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Switch(
                            checked = source.isEnabled,
                            onCheckedChange = { onToggleSource(source, it) },
                            colors = SwitchDefaults.colors(checkedTrackColor = CinemaRed)
                        )
                    }
                    if (!source.lastError.isNullOrBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = source.lastError,
                            color = Color(0xFFFF8A8A),
                            fontSize = 11.sp
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        IconButton(onClick = { onSyncSource(source) }) {
                            Icon(Icons.Rounded.Refresh, contentDescription = strings.syncNow, tint = TextPrimary)
                        }
                        IconButton(onClick = { editingSource = source }) {
                            Icon(Icons.Rounded.Edit, contentDescription = null, tint = TextSecondary)
                        }
                        IconButton(onClick = { onDeleteSource(source.id) }) {
                            Icon(Icons.Rounded.Delete, contentDescription = null, tint = CinemaRed)
                        }
                    }
                }
            }
        }

        // 3. Subtitle Defaults
        item {
            SettingsCard(title = strings.subtitleDefaultsTitle) {
                Text(
                    text = "${strings.fontSizeLabel}: ${fontSize.toInt()} sp",
                    color = TextSecondary,
                    fontSize = 13.sp
                )
                Slider(
                    value = fontSize,
                    onValueChange = {
                        fontSize = it
                        onUpdateSubtitleDefaults(it, textColor, bgColor)
                    },
                    valueRange = 12f..32f,
                    colors = SliderDefaults.colors(thumbColor = CinemaRed, activeTrackColor = CinemaRed)
                )

                Text(strings.textColorLabel, color = TextSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                val textSwatches = listOf(0xFFFFFFFFL, 0xFFFFEB3BL, 0xFF38BDF8L, 0xFF4ADE80L)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    textSwatches.forEach { hex ->
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(Color(hex))
                                .then(
                                    if (textColor == hex) Modifier.border(2.dp, CinemaRed, CircleShape)
                                    else Modifier
                                )
                                .clickable {
                                    textColor = hex
                                    onUpdateSubtitleDefaults(fontSize, hex, bgColor)
                                }
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text(strings.bgColorLabel, color = TextSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                val bgSwatches = listOf(0x00000000L, 0x77000000L, 0xCC000000L, 0xAA1E293BL)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    bgSwatches.forEach { hex ->
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(Color(hex))
                                .border(
                                    width = if (bgColor == hex) 2.dp else 1.dp,
                                    color = if (bgColor == hex) CinemaRed else CinemaSurfaceBorder,
                                    shape = CircleShape
                                )
                                .clickable {
                                    bgColor = hex
                                    onUpdateSubtitleDefaults(fontSize, textColor, hex)
                                }
                        )
                    }
                }
            }
        }

        // 4. Language & History
        item {
            SettingsCard(title = strings.languageSectionTitle) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    FilterChip(
                        selected = preferences.languageCode == "ar",
                        onClick = { onSetLanguage("ar") },
                        label = { Text(strings.arabicLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CinemaRed,
                            selectedLabelColor = TextPrimary,
                            containerColor = CinemaSurfaceElevated,
                            labelColor = TextSecondary
                        )
                    )
                    FilterChip(
                        selected = preferences.languageCode == "en",
                        onClick = { onSetLanguage("en") },
                        label = { Text(strings.englishLabel) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CinemaRed,
                            selectedLabelColor = TextPrimary,
                            containerColor = CinemaSurfaceElevated,
                            labelColor = TextSecondary
                        )
                    )
                }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(
                    onClick = onClearHistory,
                    border = BorderStroke(1.dp, CinemaSurfaceBorder),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(strings.clearHistory, color = TextSecondary)
                }
            }
        }
    }

    if (showAddSourceDialog) {
        SourceEditorDialog(
            strings = strings,
            initialName = "",
            initialUrl = "",
            initialType = SourceType.M3U_PLAYLIST,
            allowTypeChange = true,
            onDismiss = { showAddSourceDialog = false },
            onConfirm = { name, type, url ->
                onAddSource(name, type, url)
                showAddSourceDialog = false
            }
        )
    }

    editingSource?.let { src ->
        val srcType = runCatching { SourceType.valueOf(src.type) }.getOrDefault(SourceType.M3U_PLAYLIST)
        SourceEditorDialog(
            strings = strings,
            initialName = src.name,
            initialUrl = src.url,
            initialType = srcType,
            allowTypeChange = false,
            onDismiss = { editingSource = null },
            onConfirm = { name, _, url ->
                onUpdateSource(src, name, url)
                editingSource = null
            }
        )
    }
}

@Composable
private fun SettingsCard(
    title: String,
    content: @Composable () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        border = BorderStroke(1.dp, CinemaSurfaceBorder),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
            )
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun SourceEditorDialog(
    strings: AppStrings,
    initialName: String,
    initialUrl: String,
    initialType: SourceType,
    allowTypeChange: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String, SourceType, String) -> Unit
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(initialName) }
    var url by remember { mutableStateOf(initialUrl) }
    var selectedType by remember { mutableStateOf(initialType) }

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            url = uri.toString()
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text(strings.addSource, color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (allowTypeChange) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(
                            SourceType.M3U_PLAYLIST to strings.sourceTypeM3u,
                            SourceType.JSON_CATALOG to strings.sourceTypeJson,
                            SourceType.DIRECT_STREAM to strings.sourceTypeDirect
                        ).forEach { (type, label) ->
                            FilterChip(
                                selected = selectedType == type,
                                onClick = { selectedType = type },
                                label = { Text(label, fontSize = 11.sp) },
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
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.sourceNameLabel, fontSize = 12.sp) },
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
                    value = url,
                    onValueChange = { url = it },
                    label = { Text(strings.sourceUrlLabel, fontSize = 12.sp) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CinemaRed,
                        unfocusedBorderColor = CinemaSurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedButton(
                    onClick = { filePicker.launch(arrayOf("*/*")) },
                    border = BorderStroke(1.dp, CinemaSurfaceBorder),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.FolderOpen, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(strings.pickLocalFile, color = TextPrimary)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (url.isNotBlank()) onConfirm(name, selectedType, url) },
                enabled = url.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = CinemaRed)
            ) {
                Text(strings.saveChanges, color = TextPrimary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(strings.cancel, color = TextSecondary)
            }
        }
    )
}
