package com.aluqabi.cinema

import com.aluqabi.cinema.data.source.JsonCatalogParser
import org.junit.Assert.assertEquals
import org.junit.Test

class JsonCatalogParserTest {

    @Test
    fun `parses movies series seasons and channels from JSON catalog`() {
        val raw = """
            {
              "movies": [
                {
                  "tmdb_id": 550,
                  "title": "Fight Club",
                  "title_ar": "نادي القتال",
                  "year": "1999",
                  "rating": 8.4,
                  "qualities": [
                    { "label": "1080p", "url": "https://cdn.example.com/fc-1080.mp4" },
                    { "label": "720p", "url": "https://cdn.example.com/fc-720.mp4" }
                  ],
                  "subtitles": [
                    { "label": "Arabic", "language": "ar", "url": "https://cdn.example.com/fc-ar.srt" }
                  ]
                }
              ],
              "series": [
                {
                  "tmdb_id": 1396,
                  "title": "Breaking Bad",
                  "seasons": [
                    {
                      "season_number": 1,
                      "episodes": [
                        {
                          "episode_number": 1,
                          "title": "Pilot",
                          "stream_url": "https://cdn.example.com/bb-s1e1.m3u8"
                        }
                      ]
                    }
                  ]
                }
              ],
              "channels": [
                {
                  "name": "Baghdad TV",
                  "group": "Iraq",
                  "stream_url": "https://cdn.example.com/baghdad.m3u8"
                }
              ]
            }
        """.trimIndent()

        val parsed = JsonCatalogParser.parse(raw)

        assertEquals(2, parsed.items.size)
        assertEquals(1, parsed.channels.size)

        val movie = parsed.items[0]
        assertEquals(550, movie.tmdbId)
        assertEquals("MOVIE", movie.mediaType)
        assertEquals(2, movie.payload.qualities.size)
        assertEquals(1, movie.payload.subtitles.size)

        val series = parsed.items[1]
        assertEquals(1396, series.tmdbId)
        assertEquals("SERIES", series.mediaType)
        assertEquals(1, series.payload.seasons.size)
        assertEquals("https://cdn.example.com/bb-s1e1.m3u8", series.payload.seasons[0].episodes[0].streamUrl)

        assertEquals("Baghdad TV", parsed.channels[0].name)
    }
}
