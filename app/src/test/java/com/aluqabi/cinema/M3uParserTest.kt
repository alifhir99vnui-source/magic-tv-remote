package com.aluqabi.cinema

import com.aluqabi.cinema.data.source.M3uParser
import org.junit.Assert.assertEquals
import org.junit.Test

class M3uParserTest {

    @Test
    fun `parses extended M3U entries with group logo and tvg id`() {
        val sample = """
            #EXTM3U
            #EXTINF:-1 tvg-id="aliraqiya.iq" tvg-name="Al Iraqiya" tvg-logo="https://example.com/logo.png" group-title="Iraq Channels",Al Iraqiya HD
            https://stream.example.com/iraqiya/index.m3u8
            #EXTINF:-1 group-title="Sports",Iraq Sport
            http://stream.example.com/sport/live.ts
            #EXTVLCOPT:http-user-agent=VLC
            https://stream.example.com/no-extinf/channel.m3u8
        """.trimIndent()

        val result = M3uParser.parse(sample)

        assertEquals(3, result.size)
        assertEquals("Al Iraqiya HD", result[0].name)
        assertEquals("Iraq Channels", result[0].groupTitle)
        assertEquals("https://example.com/logo.png", result[0].logoUrl)
        assertEquals("aliraqiya.iq", result[0].tvgId)
        assertEquals("https://stream.example.com/iraqiya/index.m3u8", result[0].streamUrl)

        assertEquals("Iraq Sport", result[1].name)
        assertEquals("Sports", result[1].groupTitle)
        assertEquals("http://stream.example.com/sport/live.ts", result[1].streamUrl)

        assertEquals("channel.m3u8", result[2].name)
    }
}
