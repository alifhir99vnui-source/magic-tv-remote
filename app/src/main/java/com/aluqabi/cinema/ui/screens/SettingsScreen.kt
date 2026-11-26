package com.aluqabi.cinema.ui.screens

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aluqabi.cinema.data.local.AppPreferences
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun SettingsScreen(
    strings: AppStrings,
    preferences: AppPreferences,
    onUpdateSubtitleDefaults: (Float, Long, Long) -> Unit,
    onSetLanguage: (String) -> Unit,
    onClearHistory: () -> Unit,
    onClearCache: () -> Unit
) {
    val fontSize = preferences.subtitleFontSizeSp.coerceIn(12f, 32f)
    val textColor = preferences.subtitleTextColorArgb
    val bgColor = preferences.subtitleBgColorArgb

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(CinemaBackground),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            SettingsCard(title = strings.subtitleDefaultsTitle) {
                Text(text = "${strings.fontSizeLabel}: ${fontSize.toInt()} sp", color = TextSecondary, fontSize = 13.sp)
                Slider(
                    value = fontSize,
                    onValueChange = { onUpdateSubtitleDefaults(it.coerceIn(12f, 32f), textColor, bgColor) },
                    valueRange = 12f..32f,
                    colors = SliderDefaults.colors(thumbColor = CinemaRed, activeTrackColor = CinemaRed)
                )
                Text(strings.textColorLabel, color = TextSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf(0xFFFFFFFFL, 0xFFFFEB3BL, 0xFF38BDF8L, 0xFF4ADE80L).forEach { hex ->
                        Box(
                            modifier = Modifier.size(30.dp).clip(CircleShape).background(Color(hex))
                                .then(if (textColor == hex) Modifier.border(2.dp, CinemaRed, CircleShape) else Modifier)
                                .clickable { onUpdateSubtitleDefaults(fontSize, hex, bgColor) }
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(strings.bgColorLabel, color = TextSecondary, fontSize = 12.sp)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf(0x00000000L, 0x77000000L, 0xCC000000L, 0xAA1E293BL).forEach { hex ->
                        Box(
                            modifier = Modifier.size(30.dp).clip(CircleShape).background(Color(hex))
                                .border(if (bgColor == hex) 2.dp else 1.dp, if (bgColor == hex) CinemaRed else CinemaSurfaceBorder, CircleShape)
                                .clickable { onUpdateSubtitleDefaults(fontSize, textColor, hex) }
                        )
                    }
                }
            }
        }

        item {
            SettingsCard(title = strings.languageSectionTitle) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    FilterChip(
                        selected = preferences.languageCode == "ar",
                        onClick = { onSetLanguage("ar") },
                        label = { Text(strings.arabicLabel) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = CinemaRed, selectedLabelColor = TextPrimary, containerColor = CinemaSurfaceElevated, labelColor = TextSecondary)
                    )
                    FilterChip(
                        selected = preferences.languageCode == "en",
                        onClick = { onSetLanguage("en") },
                        label = { Text(strings.englishLabel) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = CinemaRed, selectedLabelColor = TextPrimary, containerColor = CinemaSurfaceElevated, labelColor = TextSecondary)
                    )
                }
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = onClearHistory, border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(strings.clearHistory, color = TextSecondary)
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onClearCache, border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(strings.clearCache, color = TextSecondary)
                }
            }
        }
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}
