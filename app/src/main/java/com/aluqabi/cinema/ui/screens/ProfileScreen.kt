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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.UserEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import com.aluqabi.cinema.data.repository.AuthResult
import com.aluqabi.cinema.domain.model.MediaCardItem
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.ui.components.EmptyStateCard
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    strings: AppStrings,
    user: UserEntity,
    favorites: List<FavoriteEntity>,
    history: List<WatchHistoryEntity>,
    onBack: () -> Unit,
    onFavoriteClick: (MediaCardItem) -> Unit,
    onHistoryClick: (WatchHistoryEntity) -> Unit,
    onUpdateProfile: (String, String?, String?, Long, (AuthResult) -> Unit) -> Unit,
    onLogout: () -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var showEditDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = CinemaBackground,
        topBar = {
            TopAppBar(
                title = { Text(strings.profileTitle, fontWeight = FontWeight.Bold, color = TextPrimary) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                colors = CardDefaults.cardColors(containerColor = CinemaSurface),
                border = BorderStroke(1.dp, CinemaSurfaceBorder),
                shape = RoundedCornerShape(18.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(62.dp)
                                .clip(CircleShape)
                                .background(Color(user.avatarColorHex)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = user.name.take(1).uppercase(),
                                color = TextPrimary,
                                fontSize = 26.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = user.name,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            val contact = user.email?.takeIf { it.isNotBlank() }
                                ?: user.phone?.takeIf { it.isNotBlank() }
                                ?: ""
                            if (contact.isNotBlank()) {
                                Text(
                                    text = contact,
                                    color = TextSecondary,
                                    fontSize = 13.sp
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "${strings.providerLabel}: ${user.authProvider}",
                                color = CinemaRed,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        IconButton(onClick = { showEditDialog = true }) {
                            Icon(
                                imageVector = Icons.Rounded.Edit,
                                contentDescription = strings.editProfile,
                                tint = TextPrimary
                            )
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(
                            onClick = { showEditDialog = true },
                            border = BorderStroke(1.dp, CinemaSurfaceBorder),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Rounded.Edit, contentDescription = null, tint = TextPrimary, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(strings.editProfile, color = TextPrimary, fontSize = 13.sp)
                        }
                        Button(
                            onClick = onLogout,
                            colors = ButtonDefaults.buttonColors(containerColor = CinemaRed.copy(alpha = 0.2f)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, tint = CinemaRed, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(strings.logout, color = CinemaRed, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }

            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = CinemaSurface,
                contentColor = TextPrimary,
                indicator = { positions ->
                    TabRowDefaults.SecondaryIndicator(
                        modifier = Modifier.tabIndicatorOffset(positions[selectedTab]),
                        color = CinemaRed
                    )
                }
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("${strings.favoritesTitle} (${favorites.size})") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("${strings.historyTitle} (${history.size})") }
                )
            }

            if (selectedTab == 0) {
                if (favorites.isEmpty()) {
                    EmptyStateCard(
                        icon = Icons.Rounded.Favorite,
                        title = strings.favoritesTitle,
                        description = strings.noFavorites
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(favorites, key = { it.recordKey }) { fav ->
                            val type = runCatching { MediaType.valueOf(fav.mediaType) }.getOrDefault(MediaType.MOVIE)
                            ProfileMediaRow(
                                title = fav.title,
                                subtitle = fav.year.ifBlank { fav.mediaType },
                                posterUrl = fav.posterUrl,
                                onClick = {
                                    onFavoriteClick(
                                        MediaCardItem(
                                            mediaKey = fav.mediaKey,
                                            mediaType = type,
                                            title = fav.title,
                                            posterUrl = fav.posterUrl,
                                            backdropUrl = fav.backdropUrl,
                                            year = fav.year,
                                            rating = fav.rating,
                                            tmdbId = fav.tmdbId,
                                            directStreamUrl = fav.streamUrl
                                        )
                                    )
                                }
                            )
                        }
                    }
                }
            } else {
                if (history.isEmpty()) {
                    EmptyStateCard(
                        icon = Icons.Rounded.History,
                        title = strings.historyTitle,
                        description = strings.noHistory
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(history, key = { it.recordKey }) { item ->
                            ProfileMediaRow(
                                title = item.title,
                                subtitle = item.subtitle.ifBlank { item.mediaType },
                                posterUrl = item.posterUrl,
                                onClick = { onHistoryClick(item) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showEditDialog) {
        EditProfileDialog(
            strings = strings,
            user = user,
            onDismiss = { showEditDialog = false },
            onSave = { name, email, phone, color ->
                onUpdateProfile(name, email, phone, color) { res ->
                    if (res is AuthResult.Success) {
                        showEditDialog = false
                    }
                }
            }
        )
    }
}

@Composable
private fun ProfileMediaRow(
    title: String,
    subtitle: String,
    posterUrl: String,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        border = BorderStroke(1.dp, CinemaSurfaceBorder),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(CinemaSurfaceElevated)
            ) {
                if (posterUrl.isNotBlank()) {
                    AsyncImage(
                        model = posterUrl,
                        contentDescription = title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = subtitle,
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Icon(
                imageVector = Icons.Rounded.PlayArrow,
                contentDescription = null,
                tint = CinemaRed
            )
        }
    }
}

@Composable
private fun EditProfileDialog(
    strings: AppStrings,
    user: UserEntity,
    onDismiss: () -> Unit,
    onSave: (String, String?, String?, Long) -> Unit
) {
    var name by remember { mutableStateOf(user.name) }
    var email by remember { mutableStateOf(user.email.orEmpty()) }
    var phone by remember { mutableStateOf(user.phone.orEmpty()) }
    var selectedColor by remember { mutableLongStateOf(user.avatarColorHex) }
    val colors = listOf(0xFFE50914L, 0xFF1E88E5L, 0xFF00897BL, 0xFF8E24AAL, 0xFFF4511EL)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CinemaSurface,
        title = { Text(strings.editProfile, color = TextPrimary, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(strings.fullName) },
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
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(strings.email) },
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
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text(strings.phoneNumber) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CinemaRed,
                        unfocusedBorderColor = CinemaSurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(top = 6.dp)
                ) {
                    colors.forEach { hex ->
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(Color(hex))
                                .then(
                                    if (selectedColor == hex) {
                                        Modifier.border(2.dp, TextPrimary, CircleShape)
                                    } else {
                                        Modifier
                                    }
                                )
                                .clickable { selectedColor = hex }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(name, email, phone, selectedColor) },
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
