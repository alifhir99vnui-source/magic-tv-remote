package com.aluqabi.cinema.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.CachedChannelEntity
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.local.entity.UserEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(user: UserEntity): Long

    @Update
    suspend fun update(user: UserEntity)

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    fun observeById(id: Long): Flow<UserEntity?>

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): UserEntity?

    @Query("SELECT * FROM users WHERE LOWER(email) = LOWER(:email) LIMIT 1")
    suspend fun getByEmail(email: String): UserEntity?

    @Query("SELECT * FROM users WHERE phone = :phone LIMIT 1")
    suspend fun getByPhone(phone: String): UserEntity?

    @Query("SELECT * FROM users WHERE authProvider = :provider LIMIT 1")
    suspend fun getByProvider(provider: String): UserEntity?
}

@Dao
interface SourceDao {
    @Query("SELECT * FROM sources ORDER BY id DESC")
    fun observeAll(): Flow<List<SourceEntity>>

    @Query("SELECT * FROM sources WHERE isEnabled = 1")
    suspend fun getEnabledSources(): List<SourceEntity>

    @Query("SELECT * FROM sources WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): SourceEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(source: SourceEntity): Long

    @Update
    suspend fun update(source: SourceEntity)

    @Query("DELETE FROM sources WHERE id = :id")
    suspend fun deleteById(id: Long)
}

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites WHERE userId = :userId ORDER BY addedAt DESC")
    fun observeForUser(userId: Long): Flow<List<FavoriteEntity>>

    @Query("SELECT * FROM favorites WHERE cloudUserId = :userId ORDER BY addedAt DESC")
    fun observeForUserLegacy(userId: String): Flow<List<FavoriteEntity>>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE recordKey = :recordKey)")
    fun observeIsFavorite(recordKey: String): Flow<Boolean>

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE recordKey = :recordKey)")
    fun observeIsFavoriteLegacy(recordKey: String): Flow<Boolean>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(favorite: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE recordKey = :recordKey")
    suspend fun deleteByKey(recordKey: String)

    @Query("DELETE FROM favorites WHERE cloudUserId = :userId")
    suspend fun clearForCloudUser(userId: String)
}

@Dao
interface WatchHistoryDao {
    @Query("SELECT * FROM watch_history WHERE userId = :userId ORDER BY updatedAt DESC")
    fun observeForUser(userId: Long): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM watch_history WHERE cloudUserId = :userId ORDER BY updatedAt DESC")
    fun observeForCloudUser(userId: String): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM watch_history WHERE recordKey = :recordKey LIMIT 1")
    suspend fun getByKey(recordKey: String): WatchHistoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(history: WatchHistoryEntity)

    @Query("DELETE FROM watch_history WHERE userId = :userId")
    suspend fun clearForUser(userId: Long)

    @Query("DELETE FROM watch_history WHERE cloudUserId = :userId")
    suspend fun clearForCloudUser(userId: String)
}

@Dao
interface MediaLinkOverrideDao {
    @Query("SELECT * FROM media_link_overrides WHERE mediaKey = :mediaKey LIMIT 1")
    fun observeByKey(mediaKey: String): Flow<MediaLinkOverrideEntity?>

    @Query("SELECT * FROM media_link_overrides WHERE mediaKey = :mediaKey LIMIT 1")
    suspend fun getByKey(mediaKey: String): MediaLinkOverrideEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(override: MediaLinkOverrideEntity)

    @Query("DELETE FROM media_link_overrides WHERE mediaKey = :mediaKey")
    suspend fun deleteByKey(mediaKey: String)
}

@Dao
interface CachedChannelDao {
    @Query(
        """
        SELECT c.* FROM cached_channels c
        INNER JOIN sources s ON c.sourceId = s.id
        WHERE s.isEnabled = 1
        ORDER BY c.groupTitle ASC, c.name ASC
        """
    )
    fun observeActiveChannels(): Flow<List<CachedChannelEntity>>

    @Query(
        """
        SELECT c.* FROM cached_channels c
        INNER JOIN sources s ON c.sourceId = s.id
        WHERE s.isEnabled = 1
        """
    )
    suspend fun getActiveChannels(): List<CachedChannelEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(channels: List<CachedChannelEntity>)

    @Query("DELETE FROM cached_channels WHERE sourceId = :sourceId")
    suspend fun deleteBySourceId(sourceId: Long)
}

@Dao
interface CachedCatalogDao {
    @Query(
        """
        SELECT i.* FROM cached_catalog_items i
        INNER JOIN sources s ON i.sourceId = s.id
        WHERE s.isEnabled = 1
        ORDER BY i.id DESC
        """
    )
    fun observeActiveItems(): Flow<List<CachedCatalogItemEntity>>

    @Query(
        """
        SELECT i.* FROM cached_catalog_items i
        INNER JOIN sources s ON i.sourceId = s.id
        WHERE s.isEnabled = 1
        """
    )
    suspend fun getActiveItems(): List<CachedCatalogItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<CachedCatalogItemEntity>)

    @Query("DELETE FROM cached_catalog_items WHERE sourceId = :sourceId")
    suspend fun deleteBySourceId(sourceId: Long)
}
