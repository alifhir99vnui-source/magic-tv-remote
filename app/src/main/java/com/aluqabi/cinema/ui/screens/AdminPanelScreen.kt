package com.aluqabi.cinema.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Search
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.aluqabi.cinema.data.remote.asArrOrEmpty
import com.aluqabi.cinema.data.remote.asObjOrNull
import com.aluqabi.cinema.data.remote.str
import com.aluqabi.cinema.domain.model.UserProfile
import com.aluqabi.cinema.domain.model.UserRole
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminPanelScreen(
    strings: AppStrings,
    onBack: () -> Unit,
    onSearchUsers: (String, (Result<List<UserProfile>>) -> Unit) -> Unit,
    onSetRole: (String, UserRole, (Result<Unit>) -> Unit) -> Unit,
    onSetBanned: (String, Boolean, (Result<Unit>) -> Unit) -> Unit,
    onListCatalog: ((Result<List<JsonObject>>) -> Unit) -> Unit,
    onUpsertCatalog: (JsonObject, String?, (Result<Unit>) -> Unit) -> Unit,
    onDeleteCatalog: (String, (Result<Unit>) -> Unit) -> Unit,
    onListChannels: ((Result<List<JsonObject>>) -> Unit) -> Unit,
    onUpsertChannel: (JsonObject, String?, (Result<Unit>) -> Unit) -> Unit,
    onDeleteChannel: (String, (Result<Unit>) -> Unit) -> Unit
) {
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf(strings.manageMembers, strings.manageCatalog, strings.manageChannels)

    Scaffold(
        containerColor = CinemaBackground,
        topBar = {
            TopAppBar(
                title = { Text(strings.adminPanel, color = TextPrimary, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = TextPrimary) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CinemaBackground)
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab, containerColor = CinemaSurface, contentColor = TextPrimary, indicator = { pos -> TabRowDefaults.SecondaryIndicator(Modifier.tabIndicatorOffset(pos[tab]), color = CinemaRed) }) {
                tabs.forEachIndexed { i, t -> Tab(selected = tab == i, onClick = { tab = i }, text = { Text(t, maxLines = 1, fontSize = 12.sp) }) }
            }
            when (tab) {
                0 -> MembersTab(strings, onSearchUsers, onSetRole, onSetBanned)
                1 -> CatalogTab(strings, onListCatalog, onUpsertCatalog, onDeleteCatalog)
                2 -> ChannelsTab(strings, onListChannels, onUpsertChannel, onDeleteChannel)
            }
        }
    }
}

@Composable
private fun MembersTab(strings: AppStrings, onSearch: (String, (Result<List<UserProfile>>) -> Unit) -> Unit, onSetRole: (String, UserRole, (Result<Unit>) -> Unit) -> Unit, onSetBanned: (String, Boolean, (Result<Unit>) -> Unit) -> Unit) {
    var query by remember { mutableStateOf("") }
    var users by remember { mutableStateOf<List<UserProfile>>(emptyList()) }
    var msg by remember { mutableStateOf<String?>(null) }
    fun refresh() = onSearch(query) { r -> r.onSuccess { users = it }.onFailure { msg = it.message } }
    LaunchedEffect(Unit) { refresh() }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text(strings.searchByEmail) }, trailingIcon = { IconButton(onClick = { refresh() }) { Icon(Icons.Rounded.Search, null, tint = CinemaRed) } }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
            msg?.let { Text(it, color = TextSecondary, fontSize = 12.sp) }
        }
        items(users, key = { it.id }) { u ->
            Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(12.dp)) {
                Column(Modifier.padding(12.dp)) {
                    Text(u.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                    Text(u.email.ifBlank { u.phone }, color = TextSecondary, fontSize = 12.sp)
                    Text(u.role.name + if (u.isBanned) " • BANNED" else "", color = if (u.isBanned) CinemaRed else TextSecondary, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { onSetRole(u.id, if (u.role == UserRole.MODERATOR) UserRole.USER else UserRole.MODERATOR) { it.onSuccess { refresh() }.onFailure { e -> msg = e.message } } }, border = BorderStroke(1.dp, CinemaSurfaceBorder)) {
                            Text(if (u.role == UserRole.MODERATOR) strings.demoteUser else strings.promoteModerator, fontSize = 11.sp, color = TextPrimary)
                        }
                        OutlinedButton(onClick = { onSetBanned(u.id, !u.isBanned) { it.onSuccess { refresh() }.onFailure { e -> msg = e.message } } }, border = BorderStroke(1.dp, CinemaSurfaceBorder)) {
                            Text(if (u.isBanned) strings.unbanUser else strings.banUser, fontSize = 11.sp, color = CinemaRed)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogTab(strings: AppStrings, onList: ((Result<List<JsonObject>>) -> Unit) -> Unit, onUpsert: (JsonObject, String?, (Result<Unit>) -> Unit) -> Unit, onDelete: (String, (Result<Unit>) -> Unit) -> Unit) {
    var items by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var msg by remember { mutableStateOf<String?>(null) }
    var editId by remember { mutableStateOf<String?>(null) }
    var tmdbId by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("MOVIE") }
    var streamUrl by remember { mutableStateOf("") }
    var qualities by remember { mutableStateOf("[{\"label\":\"1080p\",\"url\":\"\"}]") }
    var subtitles by remember { mutableStateOf("[]") }
    fun refresh() = onList { r -> r.onSuccess { items = it }.onFailure { msg = it.message } }
    LaunchedEffect(Unit) { refresh() }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(12.dp)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (editId == null) strings.add else strings.update, color = TextPrimary, fontWeight = FontWeight.Bold)
                    OutlinedTextField(tmdbId, { tmdbId = it.filter(Char::isDigit) }, label = { Text(strings.tmdbIdLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(title, { title = it }, label = { Text(strings.titleLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { type = "MOVIE" }, border = BorderStroke(1.dp, if (type == "MOVIE") CinemaRed else CinemaSurfaceBorder)) { Text("MOVIE", color = TextPrimary) }
                        OutlinedButton(onClick = { type = "SERIES" }, border = BorderStroke(1.dp, if (type == "SERIES") CinemaRed else CinemaSurfaceBorder)) { Text("SERIES", color = TextPrimary) }
                    }
                    OutlinedTextField(streamUrl, { streamUrl = it }, label = { Text(strings.streamUrlLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(qualities, { qualities = it }, label = { Text(strings.qualitiesJsonLabel) }, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(subtitles, { subtitles = it }, label = { Text(strings.subtitlesJsonLabel) }, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    Button(onClick = {
                        val payload = buildJsonObject {
                            tmdbId.toIntOrNull()?.let { put("tmdb_id", it) }
                            put("media_type", type); put("title", title); put("stream_url", streamUrl)
                            put("qualities", runCatching { kotlinx.serialization.json.Json.parseToJsonElement(qualities) }.getOrElse { JsonArray(emptyList()) })
                            put("subtitles", runCatching { kotlinx.serialization.json.Json.parseToJsonElement(subtitles) }.getOrElse { JsonArray(emptyList()) })
                        }
                        onUpsert(payload, editId) { r -> r.onSuccess { msg = "OK"; editId = null; title = ""; streamUrl = ""; refresh() }.onFailure { msg = it.message } }
                    }, colors = ButtonDefaults.buttonColors(containerColor = CinemaRed)) { Text(strings.saveChanges, color = TextPrimary) }
                    msg?.let { Text(it, color = TextSecondary, fontSize = 12.sp) }
                }
            }
        }
        items(items, key = { it.str("id") }) { item ->
            Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder)) {
                Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(item.str("title"), color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text("${item.str("media_type")} • TMDB ${item.str("tmdb_id")}", color = TextSecondary, fontSize = 12.sp)
                    }
                    Row {
                        OutlinedButton(onClick = { editId = item.str("id"); tmdbId = item.str("tmdb_id"); title = item.str("title"); type = item.str("media_type").ifBlank { "MOVIE" }; streamUrl = item.str("stream_url"); qualities = item["qualities"]?.toString() ?: "[]"; subtitles = item["subtitles"]?.toString() ?: "[]" }) { Text(strings.update, fontSize = 11.sp) }
                        IconButton(onClick = { onDelete(item.str("id")) { r -> r.onSuccess { refresh() }.onFailure { msg = it.message } } }) { Icon(Icons.Rounded.Delete, null, tint = CinemaRed) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelsTab(strings: AppStrings, onList: ((Result<List<JsonObject>>) -> Unit) -> Unit, onUpsert: (JsonObject, String?, (Result<Unit>) -> Unit) -> Unit, onDelete: (String, (Result<Unit>) -> Unit) -> Unit) {
    var items by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var msg by remember { mutableStateOf<String?>(null) }
    var editId by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf("") }
    var group by remember { mutableStateOf("") }
    var logo by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    fun refresh() = onList { r -> r.onSuccess { items = it }.onFailure { msg = it.message } }
    LaunchedEffect(Unit) { refresh() }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder), shape = RoundedCornerShape(12.dp)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (editId == null) strings.add else strings.update, color = TextPrimary, fontWeight = FontWeight.Bold)
                    OutlinedTextField(name, { name = it }, label = { Text(strings.titleLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(group, { group = it }, label = { Text("Group") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(logo, { logo = it }, label = { Text("Logo URL") }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    OutlinedTextField(url, { url = it }, label = { Text(strings.streamUrlLabel) }, singleLine = true, modifier = Modifier.fillMaxWidth(), colors = adminFieldColors())
                    Button(onClick = {
                        val payload = buildJsonObject { put("name", name); put("group_title", group.ifBlank { "General" }); put("logo_url", logo); put("stream_url", url); put("is_active", true) }
                        onUpsert(payload, editId) { r -> r.onSuccess { msg = "OK"; editId = null; name = ""; url = ""; refresh() }.onFailure { msg = it.message } }
                    }, colors = ButtonDefaults.buttonColors(containerColor = CinemaRed)) { Text(strings.saveChanges, color = TextPrimary) }
                    msg?.let { Text(it, color = TextSecondary, fontSize = 12.sp) }
                }
            }
        }
        items(items, key = { it.str("id") }) { item ->
            Card(colors = CardDefaults.cardColors(containerColor = CinemaSurface), border = BorderStroke(1.dp, CinemaSurfaceBorder)) {
                Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) { Text(item.str("name"), color = TextPrimary, fontWeight = FontWeight.Bold); Text(item.str("group_title"), color = TextSecondary, fontSize = 12.sp) }
                    Row {
                        OutlinedButton(onClick = { editId = item.str("id"); name = item.str("name"); group = item.str("group_title"); logo = item.str("logo_url"); url = item.str("stream_url") }) { Text(strings.update, fontSize = 11.sp) }
                        IconButton(onClick = { onDelete(item.str("id")) { r -> r.onSuccess { refresh() }.onFailure { msg = it.message } } }) { Icon(Icons.Rounded.Delete, null, tint = CinemaRed) }
                    }
                }
            }
        }
    }
}

@Composable
private fun adminFieldColors() = OutlinedTextFieldDefaults.colors(focusedBorderColor = CinemaRed, unfocusedBorderColor = CinemaSurfaceBorder, focusedTextColor = TextPrimary, unfocusedTextColor = TextPrimary, focusedContainerColor = CinemaSurfaceElevated, unfocusedContainerColor = CinemaSurfaceElevated)
