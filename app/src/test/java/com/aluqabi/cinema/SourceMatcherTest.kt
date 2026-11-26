package com.aluqabi.cinema

import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.data.source.JsonCatalogParser
import com.aluqabi.cinema.data.source.SourceMatcher
import com.aluqabi.cinema.domain.model.CatalogItemPayload
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.StreamQualityOption
import org.junit.Assert.assertEquals
import org.junit.Test

class SourceMatcherTest {

    @Test
    fun `manual override takes priority over JSON catalog match`() {
        val payload = CatalogItemPayload(
            qualities = listOf(StreamQualityOption("1080p", "https://json.example.com/movie.mp4"))
        )
        val catalogItem = CachedCatalogItemEntity(
            id = 1,
            sourceId = 1,
            tmdbId = 550,
            mediaType = "MOVIE",
            title = "Fight Club",
            payloadJson = JsonCatalogParser.encodePayload(payload)
        )
        val override = MediaLinkOverrideEntity(
            mediaKey = "movie_550",
            tmdbId = 550,
            mediaType = "MOVIE",
            streamUrl = "https://manual.example.com/override.m3u8"
        )

        val resolvedWithOverride = SourceMatcher.resolve(
            mediaType = MediaType.MOVIE,
            tmdbId = 550,
            title = "Fight Club",
            originalTitle = "Fight Club",
            overrideEntity = override,
            catalogItems = listOf(catalogItem),
            m3uEntries = emptyList()
        )
        assertEquals("https://manual.example.com/override.m3u8", resolvedWithOverride.primaryUrl)

        val resolvedFromJson = SourceMatcher.resolve(
            mediaType = MediaType.MOVIE,
            tmdbId = 550,
            title = "Fight Club",
            originalTitle = "Fight Club",
            overrideEntity = null,
            catalogItems = listOf(catalogItem),
            m3uEntries = emptyList()
        )
        assertEquals("https://json.example.com/movie.mp4", resolvedFromJson.primaryUrl)
    }
}
