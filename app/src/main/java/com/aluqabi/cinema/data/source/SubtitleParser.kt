package com.aluqabi.cinema.data.source

data class SubtitleCue(
    val startMs: Long,
    val endMs: Long,
    val text: String
)

/**
 * Parses SRT and WebVTT subtitle files into timestamped cues with millisecond sync lookup.
 */
object SubtitleParser {
    private val TIMESTAMP_REGEX = Regex(
        """(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})"""
    )
    private val HTML_TAG_REGEX = Regex("""<[^>]+>|\{[^}]+\}""")

    fun parse(rawContent: String): List<SubtitleCue> {
        if (rawContent.isBlank()) return emptyList()
        val normalized = rawContent
            .removePrefix("\uFEFF")
            .replace("\r\n", "\n")
            .replace('\r', '\n')

        val blocks = normalized.split(Regex("""\n{2,}"""))
        val cues = mutableListOf<SubtitleCue>()

        for (block in blocks) {
            val lines = block.lines().map { it.trimEnd() }.filter { it.isNotBlank() }
            if (lines.isEmpty()) continue
            if (lines.first().startsWith("WEBVTT", ignoreCase = true) ||
                lines.first().startsWith("NOTE", ignoreCase = true)
            ) {
                continue
            }

            val timeLineIndex = lines.indexOfFirst { TIMESTAMP_REGEX.containsMatchIn(it) }
            if (timeLineIndex < 0) continue

            val match = TIMESTAMP_REGEX.find(lines[timeLineIndex]) ?: continue
            val startMs = parseTimestampMs(
                hours = match.groupValues[1],
                minutes = match.groupValues[2],
                seconds = match.groupValues[3],
                millis = match.groupValues[4]
            )
            val endMs = parseTimestampMs(
                hours = match.groupValues[5],
                minutes = match.groupValues[6],
                seconds = match.groupValues[7],
                millis = match.groupValues[8]
            )

            val text = lines.drop(timeLineIndex + 1)
                .joinToString("\n")
                .replace(HTML_TAG_REGEX, "")
                .trim()

            if (text.isNotBlank() && endMs > startMs) {
                cues += SubtitleCue(startMs = startMs, endMs = endMs, text = text)
            }
        }
        return cues.sortedBy { it.startMs }
    }

    /**
     * Finds active cue text at [positionMs] adjusted by [offsetMs].
     * Positive [offsetMs] delays subtitles; negative [offsetMs] advances them.
     */
    fun findCueAt(cues: List<SubtitleCue>, positionMs: Long, offsetMs: Long = 0L): String {
        if (cues.isEmpty()) return ""
        val targetMs = positionMs - offsetMs
        if (targetMs < 0L) return ""

        // Binary search for the last cue with startMs <= targetMs
        var low = 0
        var high = cues.lastIndex
        var candidate = -1
        while (low <= high) {
            val mid = (low + high) ushr 1
            if (cues[mid].startMs <= targetMs) {
                candidate = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }
        if (candidate < 0) return ""
        val cue = cues[candidate]
        return if (targetMs <= cue.endMs) cue.text else ""
    }

    private fun parseTimestampMs(
        hours: String,
        minutes: String,
        seconds: String,
        millis: String
    ): Long {
        val h = hours.toLongOrNull() ?: 0L
        val m = minutes.toLongOrNull() ?: 0L
        val s = seconds.toLongOrNull() ?: 0L
        val ms = millis.toLongOrNull() ?: 0L
        return ((h * 3600L) + (m * 60L) + s) * 1000L + ms
    }
}
