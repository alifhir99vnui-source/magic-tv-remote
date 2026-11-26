package com.aluqabi.cinema.data.source

data class ParsedM3uEntry(
    val name: String,
    val groupTitle: String,
    val logoUrl: String,
    val streamUrl: String,
    val tvgId: String = ""
)

/**
 * Parses standard and extended #EXTM3U / #EXTINF playlists into structured channel or VOD entries.
 */
object M3uParser {
    private val ATTR_REGEX = Regex("""([A-Za-z0-9_-]+)="([^"]*)"""")

    fun parse(rawContent: String, defaultGroup: String = "General"): List<ParsedM3uEntry> {
        if (rawContent.isBlank()) return emptyList()
        val lines = rawContent.lineSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toList()

        val entries = mutableListOf<ParsedM3uEntry>()
        var pendingName = ""
        var pendingGroup = defaultGroup
        var pendingLogo = ""
        var pendingTvgId = ""
        var hasExtInf = false

        for (line in lines) {
            when {
                line.startsWith("#EXTM3U", ignoreCase = true) -> continue
                line.startsWith("#EXTINF", ignoreCase = true) -> {
                    hasExtInf = true
                    val attrs = mutableMapOf<String, String>()
                    ATTR_REGEX.findAll(line).forEach { match ->
                        attrs[match.groupValues[1].lowercase()] = match.groupValues[2].trim()
                    }
                    val commaIndex = line.lastIndexOf(',')
                    val titlePart = if (commaIndex in 0 until line.lastIndex) {
                        line.substring(commaIndex + 1).trim()
                    } else {
                        ""
                    }
                    pendingTvgId = attrs["tvg-id"].orEmpty()
                    pendingLogo = attrs["tvg-logo"].orEmpty()
                    pendingGroup = attrs["group-title"]?.takeIf { it.isNotBlank() } ?: defaultGroup
                    pendingName = titlePart.ifBlank { attrs["tvg-name"].orEmpty() }
                }
                line.startsWith("#") -> {
                    // Ignore metadata directives like #EXTVLCOPT or #EXTGRP unless needed
                    if (line.startsWith("#EXTGRP:", ignoreCase = true)) {
                        val grp = line.substringAfter(':').trim()
                        if (grp.isNotBlank()) pendingGroup = grp
                    }
                }
                else -> {
                    val url = line
                    if (isSupportedStreamUrl(url)) {
                        val fallbackName = url.substringAfterLast('/').substringBefore('?')
                            .ifBlank { "Channel ${entries.size + 1}" }
                        entries += ParsedM3uEntry(
                            name = if (hasExtInf && pendingName.isNotBlank()) pendingName else fallbackName,
                            groupTitle = pendingGroup.ifBlank { defaultGroup },
                            logoUrl = pendingLogo,
                            streamUrl = url,
                            tvgId = pendingTvgId
                        )
                    }
                    hasExtInf = false
                    pendingName = ""
                    pendingGroup = defaultGroup
                    pendingLogo = ""
                    pendingTvgId = ""
                }
            }
        }
        return entries
    }

    private fun isSupportedStreamUrl(url: String): Boolean {
        val lower = url.lowercase()
        return lower.startsWith("http://") ||
            lower.startsWith("https://") ||
            lower.startsWith("rtmp://") ||
            lower.startsWith("rtsp://")
    }
}
