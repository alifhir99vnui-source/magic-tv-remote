package com.aluqabi.cinema

import android.app.Application
import com.aluqabi.cinema.di.AppContainer

/**
 * Application entry point holding the shared dependency container.
 */
class AlUqabiCinemaApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
