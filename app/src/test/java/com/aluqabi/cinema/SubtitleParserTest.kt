package com.aluqabi.cinema

import com.aluqabi.cinema.data.source.SubtitleParser
import org.junit.Assert.assertEquals
import org.junit.Test

class SubtitleParserTest {

    @Test
    fun `parses SRT cues strips tags and applies millisecond sync offset`() {
        val srt = """
            1
            00:00:01,000 --> 00:00:03,500
            <i>مرحباً بكم في سينما العقابي</i>

            2
            00:00:05,000 --> 00:00:08,000
            الترجمة تعمل بدقة
        """.trimIndent()

        val cues = SubtitleParser.parse(srt)
        assertEquals(2, cues.size)
        assertEquals("مرحباً بكم في سينما العقابي", cues[0].text)

        assertEquals("مرحباً بكم في سينما العقابي", SubtitleParser.findCueAt(cues, 2000L, 0L))
        assertEquals("", SubtitleParser.findCueAt(cues, 4000L, 0L))

        // +1000ms delay means cue 1 (1000..3500) appears at 2000..4500
        assertEquals("مرحباً بكم في سينما العقابي", SubtitleParser.findCueAt(cues, 4000L, 1000L))
    }

    @Test
    fun `parses WebVTT cues`() {
        val vtt = """
            WEBVTT

            00:02.500 --> 00:05.000
            Line one
            Line two
        """.trimIndent()

        val cues = SubtitleParser.parse(vtt)
        assertEquals(1, cues.size)
        assertEquals(2500L, cues[0].startMs)
        assertEquals("Line one\nLine two", cues[0].text)
    }
}
