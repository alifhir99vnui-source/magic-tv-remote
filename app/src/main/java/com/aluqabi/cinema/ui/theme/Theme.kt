package com.aluqabi.cinema.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val CinemaDarkColorScheme = darkColorScheme(
    primary = CinemaRed,
    onPrimary = TextPrimary,
    secondary = CinemaGold,
    onSecondary = CinemaBackground,
    background = CinemaBackground,
    onBackground = TextPrimary,
    surface = CinemaSurface,
    onSurface = TextPrimary,
    surfaceVariant = CinemaSurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = CinemaSurfaceBorder
)

private val CinemaTypography = Typography(
    headlineLarge = TextStyle(
        fontSize = 26.sp,
        fontWeight = FontWeight.Bold,
        color = TextPrimary
    ),
    headlineMedium = TextStyle(
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        color = TextPrimary
    ),
    titleMedium = TextStyle(
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        color = TextPrimary
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        fontWeight = FontWeight.Normal,
        color = TextSecondary
    ),
    labelMedium = TextStyle(
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        color = TextSecondary
    )
)

@Composable
fun AlUqabiCinemaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = CinemaDarkColorScheme,
        typography = CinemaTypography,
        content = content
    )
}
