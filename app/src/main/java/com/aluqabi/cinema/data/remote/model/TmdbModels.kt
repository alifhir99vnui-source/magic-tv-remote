package com.aluqabi.cinema.data.remote.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TmdbPagedResponse(
    val page: Int = 1,
    val results: List<TmdbMediaDto> = emptyList(),
    @SerialName("total_pages") val totalPages: Int = 1
)

@Serializable
data class TmdbMediaDto(
    val id: Int,
    @SerialName("media_type") val mediaType: String? = null,
    val title: String? = null,
    val name: String? = null,
    @SerialName("original_title") val originalTitle: String? = null,
    @SerialName("original_name") val originalName: String? = null,
    val overview: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("first_air_date") val firstAirDate: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    @SerialName("genre_ids") val genreIds: List<Int> = emptyList()
)

@Serializable
data class TmdbGenreResponse(
    val genres: List<TmdbGenreDto> = emptyList()
)

@Serializable
data class TmdbGenreDto(
    val id: Int,
    val name: String
)

@Serializable
data class TmdbMovieDetailDto(
    val id: Int,
    val title: String = "",
    @SerialName("original_title") val originalTitle: String? = null,
    val overview: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("release_date") val releaseDate: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    val runtime: Int? = null,
    val genres: List<TmdbGenreDto> = emptyList()
)

@Serializable
data class TmdbSeriesDetailDto(
    val id: Int,
    val name: String = "",
    @SerialName("original_name") val originalName: String? = null,
    val overview: String? = null,
    @SerialName("poster_path") val posterPath: String? = null,
    @SerialName("backdrop_path") val backdropPath: String? = null,
    @SerialName("first_air_date") val firstAirDate: String? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0,
    val genres: List<TmdbGenreDto> = emptyList(),
    val seasons: List<TmdbSeasonSummaryDto> = emptyList()
)

@Serializable
data class TmdbSeasonSummaryDto(
    val id: Int = 0,
    @SerialName("season_number") val seasonNumber: Int = 1,
    val name: String = "",
    @SerialName("episode_count") val episodeCount: Int = 0,
    @SerialName("poster_path") val posterPath: String? = null
)

@Serializable
data class TmdbSeasonDetailDto(
    val id: Int = 0,
    @SerialName("season_number") val seasonNumber: Int = 1,
    val name: String = "",
    val episodes: List<TmdbEpisodeDto> = emptyList()
)

@Serializable
data class TmdbEpisodeDto(
    val id: Int = 0,
    @SerialName("episode_number") val episodeNumber: Int = 1,
    @SerialName("season_number") val seasonNumber: Int = 1,
    val name: String = "",
    val overview: String? = null,
    @SerialName("still_path") val stillPath: String? = null,
    val runtime: Int? = null,
    @SerialName("vote_average") val voteAverage: Double = 0.0
)

object TmdbImageUrl {
    fun poster(path: String?): String =
        if (path.isNullOrBlank()) "" else if (path.startsWith("http")) path else "https://image.tmdb.org/t/p/w500$path"

    fun backdrop(path: String?): String =
        if (path.isNullOrBlank()) "" else if (path.startsWith("http")) path else "https://image.tmdb.org/t/p/w1280$path"
}
