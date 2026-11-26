package com.aluqabi.cinema.data.source

import com.aluqabi.cinema.domain.model.CatalogEpisodePayload
import com.aluqabi.cinema.domain.model.CatalogItemPayload
import com.aluqabi.cinema.domain.model.CatalogSeasonPayload
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.SubtitleTrackOption
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ParsedCatalogItem(
    val tmdbId: Int?,
    val mediaType: String, // MOVIE or SERIES
    val title: String,
    val titleAr: String,
    val originalTitle: String,
    val overview: String,
    val posterUrl: String,
    val backdropUrl: String,
    val year: String,
    val rating: Double,
    val genres: List<String>,
    val payload: CatalogItemPayload
)

data class ParsedCatalogResult(
    val items: List<ParsedCatalogItem>,
    val channels: List<ParsedM3uEntry>
)

/**
 * Parses custom JSON feeds into movies, series (with seasons/episodes), and live channels.
 * Supports top-level JSON arrays or objects with keys like movies/series/channels/items.
 */
object JsonCatalogParser {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun encodePayload(payload: CatalogItemPayload): String =
        json.encodeToString(CatalogItemPayload.serializer(), payload)

    fun decodePayload(payloadJson: String): CatalogItemPayload {
        if (payloadJson.isBlank()) return CatalogItemPayload()
        return runCatching {
            json.decodeFromString(CatalogItemPayload.serializer(), payloadJson)
        }.getOrDefault(CatalogItemPayload())
    }

    fun parse(rawJson: String): ParsedCatalogResult {
        if (rawJson.isBlank()) return ParsedCatalogResult(emptyList(), emptyList())
        val root = json.parseToJsonElement(rawJson)
        val items = mutableListOf<ParsedCatalogItem>()
        val channels = mutableListOf<ParsedM3uEntry>()

        when (root) {
            is JsonArray -> {
                root.forEach { element ->
                    (element as? JsonObject)?.let { obj ->
                        classifyAndAdd(obj, defaultType = null, items, channels)
                    }
                }
            }
            is JsonObject -> {
                root["movies"]?.let { arr ->
                    (arr as? JsonArray)?.forEach { el ->
                        (el as? JsonObject)?.let { classifyAndAdd(it, "MOVIE", items, channels) }
                    }
                }
                root["series"]?.let { arr ->
                    (arr as? JsonArray)?.forEach { el ->
                        (el as? JsonObject)?.let { classifyAndAdd(it, "SERIES", items, channels) }
                    }
                }
                root["tv"]?.let { arr ->
                    (arr as? JsonArray)?.forEach { el ->
                        (el as? JsonObject)?.let { classifyAndAdd(it, "LIVE_TV", items, channels) }
                    }
                }
                root["channels"]?.let { arr ->
                    (arr as? JsonArray)?.forEach { el ->
                        (el as? JsonObject)?.let { classifyAndAdd(it, "LIVE_TV", items, channels) }
                    }
                }
                root["items"]?.let { arr ->
                    (arr as? JsonArray)?.forEach { el ->
                        (el as? JsonObject)?.let { classifyAndAdd(it, null, items, channels) }
                    }
                }
                if (items.isEmpty() && channels.isEmpty() && looksLikeSingleItem(root)) {
                    classifyAndAdd(root, null, items, channels)
                }
            }
            else -> Unit
        }
        return ParsedCatalogResult(items, channels)
    }

    private fun looksLikeSingleItem(obj: JsonObject): Boolean =
        obj.containsKey("title") || obj.containsKey("name") || obj.containsKey("stream_url") || obj.containsKey("url")

    private fun classifyAndAdd(
        obj: JsonObject,
        defaultType: String?,
        items: MutableList<ParsedCatalogItem>,
        channels: MutableList<ParsedM3uEntry>
    ) {
        val rawType = (obj.str("type") ?: obj.str("media_type") ?: defaultType ?: "").uppercase()
        val hasSeasons = obj["seasons"] is JsonArray || obj["episodes"] is JsonArray
        val resolvedType = when {
            rawType in setOf("LIVE", "LIVE_TV", "CHANNEL", "TV_CHANNEL") -> "LIVE_TV"
            rawType in setOf("SERIES", "TV", "SHOW") || hasSeasons -> "SERIES"
            else -> "MOVIE"
        }

        if (resolvedType == "LIVE_TV") {
            val streamUrl = obj.str("stream_url") ?: obj.str("url") ?: obj.str("stream") ?: ""
            val name = obj.str("name") ?: obj.str("title") ?: ""
            if (streamUrl.isNotBlank() && name.isNotBlank()) {
                channels += ParsedM3uEntry(
                    name = name,
                    groupTitle = obj.str("group") ?: obj.str("category") ?: "General",
                    logoUrl = obj.str("logo") ?: obj.str("poster") ?: "",
                    streamUrl = streamUrl,
                    tvgId = obj.str("tvg_id") ?: ""
                )
            }
            return
        }

        val title = obj.str("title") ?: obj.str("name") ?: ""
        val titleAr = obj.str("title_ar") ?: obj.str("arabic_title") ?: ""
        val originalTitle = obj.str("original_title") ?: obj.str("original_name") ?: ""
        val streamUrl = obj.str("stream_url") ?: obj.str("url") ?: obj.str("video_url") ?: ""
        val qualities = parseQualities(obj["qualities"] ?: obj["streams"], streamUrl)
        val subtitles = parseSubtitles(obj["subtitles"])
        val seasons = parseSeasons(obj)

        items += ParsedCatalogItem(
            tmdbId = obj.int("tmdb_id") ?: obj.int("tmdbId"),
            mediaType = resolvedType,
            title = title.ifBlank { titleAr.ifBlank { originalTitle } },
            titleAr = titleAr,
            originalTitle = originalTitle,
            overview = obj.str("overview") ?: obj.str("description") ?: "",
            posterUrl = obj.str("poster") ?: obj.str("poster_url") ?: "",
            backdropUrl = obj.str("backdrop") ?: obj.str("backdrop_url") ?: "",
            year = obj.str("year") ?: "",
            rating = obj.double("rating") ?: 0.0,
            genres = parseGenres(obj["genres"]),
            payload = CatalogItemPayload(
                streamUrl = streamUrl,
                qualities = qualities,
                subtitles = subtitles,
                seasons = seasons
            )
        )
    }

    private fun parseQualities(element: JsonElement?, fallbackUrl: String): List<StreamQualityOption> {
        val list = mutableListOf<StreamQualityOption>()
        (element as? JsonArray)?.forEach { item ->
            (item as? JsonObject)?.let { obj ->
                val url = obj.str("url") ?: obj.str("stream_url") ?: ""
                val label = obj.str("label") ?: obj.str("quality") ?: "Auto"
                if (url.isNotBlank()) {
                    list += StreamQualityOption(label = label, url = url)
                }
            }
        }
        if (list.isEmpty() && fallbackUrl.isNotBlank()) {
            list += StreamQualityOption(label = "Auto", url = fallbackUrl)
        }
        return list
    }

    private fun parseSubtitles(element: JsonElement?): List<SubtitleTrackOption> {
        val list = mutableListOf<SubtitleTrackOption>()
        (element as? JsonArray)?.forEach { item ->
            (item as? JsonObject)?.let { obj ->
                val url = obj.str("url") ?: ""
                if (url.isNotBlank()) {
                    list += SubtitleTrackOption(
                        label = obj.str("label") ?: obj.str("lang") ?: "Arabic",
                        language = obj.str("language") ?: obj.str("lang") ?: "ar",
                        url = url
                    )
                }
            }
        }
        return list
    }

    private fun parseSeasons(rootObj: JsonObject): List<CatalogSeasonPayload> {
        val seasonsArray = rootObj["seasons"] as? JsonArray
        if (seasonsArray != null) {
            return seasonsArray.mapNotNull { el ->
                val obj = el as? JsonObject ?: return@mapNotNull null
                val seasonNum = obj.int("season_number") ?: obj.int("season") ?: 1
                val eps = (obj["episodes"] as? JsonArray)?.mapNotNull { epEl ->
                    parseEpisode(epEl as? JsonObject)
                }.orEmpty()
                CatalogSeasonPayload(seasonNumber = seasonNum, episodes = eps)
            }
        }
        val flatEpisodes = rootObj["episodes"] as? JsonArray
        if (flatEpisodes != null) {
            val eps = flatEpisodes.mapNotNull { parseEpisode(it as? JsonObject) }
            if (eps.isNotEmpty()) {
                return listOf(CatalogSeasonPayload(seasonNumber = 1, episodes = eps))
            }
        }
        return emptyList()
    }

    private fun parseEpisode(obj: JsonObject?): CatalogEpisodePayload? {
        obj ?: return null
        val epNum = obj.int("episode_number") ?: obj.int("episode") ?: return null
        val streamUrl = obj.str("stream_url") ?: obj.str("url") ?: ""
        return CatalogEpisodePayload(
            episodeNumber = epNum,
            title = obj.str("title") ?: obj.str("name") ?: "",
            overview = obj.str("overview") ?: "",
            stillUrl = obj.str("still") ?: obj.str("poster") ?: "",
            streamUrl = streamUrl,
            qualities = parseQualities(obj["qualities"] ?: obj["streams"], streamUrl),
            subtitles = parseSubtitles(obj["subtitles"])
        )
    }

    private fun parseGenres(element: JsonElement?): List<String> {
        val arr = element as? JsonArray ?: return emptyList()
        return arr.mapNotNull { (it as? JsonPrimitive)?.content?.trim() }.filter { it.isNotEmpty() }
    }

    private fun JsonObject.str(key: String): String? =
        (this[key] as? JsonPrimitive)?.content?.trim()?.takeIf { it.isNotEmpty() }

    private fun JsonObject.int(key: String): Int? =
        (this[key] as? JsonPrimitive)?.intOrNull

    private fun JsonObject.double(key: String): Double? =
        (this[key] as? JsonPrimitive)?.doubleOrNull
}
