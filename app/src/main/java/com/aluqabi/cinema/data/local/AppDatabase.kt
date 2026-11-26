package com.aluqabi.cinema.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.aluqabi.cinema.data.local.dao.CachedCatalogDao
import com.aluqabi.cinema.data.local.dao.CachedChannelDao
import com.aluqabi.cinema.data.local.dao.FavoriteDao
import com.aluqabi.cinema.data.local.dao.MediaLinkOverrideDao
import com.aluqabi.cinema.data.local.dao.SourceDao
import com.aluqabi.cinema.data.local.dao.UserDao
import com.aluqabi.cinema.data.local.dao.WatchHistoryDao
import com.aluqabi.cinema.data.local.entity.CachedCatalogItemEntity
import com.aluqabi.cinema.data.local.entity.CachedChannelEntity
import com.aluqabi.cinema.data.local.entity.FavoriteEntity
import com.aluqabi.cinema.data.local.entity.MediaLinkOverrideEntity
import com.aluqabi.cinema.data.local.entity.SourceEntity
import com.aluqabi.cinema.data.local.entity.UserEntity
import com.aluqabi.cinema.data.local.entity.WatchHistoryEntity

@Database(
    entities = [
        UserEntity::class,
        SourceEntity::class,
        FavoriteEntity::class,
        WatchHistoryEntity::class,
        MediaLinkOverrideEntity::class,
        CachedChannelEntity::class,
        CachedCatalogItemEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun sourceDao(): SourceDao
    abstract fun favoriteDao(): FavoriteDao
    abstract fun watchHistoryDao(): WatchHistoryDao
    abstract fun mediaLinkOverrideDao(): MediaLinkOverrideDao
    abstract fun cachedChannelDao(): CachedChannelDao
    abstract fun cachedCatalogDao(): CachedCatalogDao

    companion object {
        fun build(context: Context): AppDatabase {
            return Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                "al_uqabi_cinema.db"
            ).build()
        }
    }
}
