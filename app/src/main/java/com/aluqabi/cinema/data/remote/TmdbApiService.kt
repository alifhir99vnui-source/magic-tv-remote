package com.aluqabi.cinema.data.remote

import com.aluqabi.cinema.data.remote.model.TmdbGenreResponse
import com.aluqabi.cinema.data.remote.model.TmdbMovieDetailDto
import com.aluqabi.cinema.data.remote.model.TmdbPagedResponse
import com.aluqabi.cinema.data.remote.model.TmdbSeasonDetailDto
import com.aluqabi.cinema.data.remote.model.TmdbSeriesDetailDto
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.http.Query

interface TmdbApiService {

    @GET("trending/all/week")
    suspend fun getTrendingAll(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("movie/popular")
    suspend fun getPopularMovies(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("movie/top_rated")
    suspend fun getTopRatedMovies(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("discover/movie")
    suspend fun discoverMovies(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("with_genres") genreId: Int?,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("genre/movie/list")
    suspend fun getMovieGenres(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String
    ): TmdbGenreResponse

    @GET("tv/popular")
    suspend fun getPopularSeries(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("tv/top_rated")
    suspend fun getTopRatedSeries(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("discover/tv")
    suspend fun discoverSeries(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String,
        @Query("with_genres") genreId: Int?,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("genre/tv/list")
    suspend fun getSeriesGenres(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String
    ): TmdbGenreResponse

    @GET("search/multi")
    suspend fun searchMulti(
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("query") query: String,
        @Query("language") language: String,
        @Query("page") page: Int = 1
    ): TmdbPagedResponse

    @GET("movie/{movie_id}")
    suspend fun getMovieDetails(
        @Path("movie_id") movieId: Int,
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String
    ): TmdbMovieDetailDto

    @GET("tv/{tv_id}")
    suspend fun getSeriesDetails(
        @Path("tv_id") tvId: Int,
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String
    ): TmdbSeriesDetailDto

    @GET("tv/{tv_id}/season/{season_number}")
    suspend fun getSeasonDetails(
        @Path("tv_id") tvId: Int,
        @Path("season_number") seasonNumber: Int,
        @Query("api_key") apiKey: String?,
        @Header("Authorization") bearer: String?,
        @Query("language") language: String
    ): TmdbSeasonDetailDto
}
