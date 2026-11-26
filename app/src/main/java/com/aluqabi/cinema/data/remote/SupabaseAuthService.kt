package com.aluqabi.cinema.data.remote

import android.content.Intent
import com.aluqabi.cinema.config.AppConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.OAuthProvider
import io.github.jan.supabase.auth.providers.invoke
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.IDToken
import io.github.jan.supabase.auth.user.UserInfo
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class SupabaseAuthService(private val client: SupabaseClient) {

    suspend fun signUpWithEmail(email: String, password: String, name: String): UserInfo? {
        awaitReady()
        return client.auth.signUpWith(Email) {
            this.email = email
            this.password = password
            data = buildJsonObject { put("name", name) }
        }
    }

    suspend fun signInWithEmail(email: String, password: String) {
        awaitReady()
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signInWithGoogle(idToken: String) {
        awaitReady()
        client.auth.signInWith(IDToken) {
            this.idToken = idToken
            provider = Google
        }
    }

    suspend fun signInWithFacebook() {
        awaitReady()
        client.auth.signInWith(OAuthProvider("facebook"), AppConfig.AUTH_REDIRECT_URL)
    }

    suspend fun refreshSession(): Boolean {
        awaitReady()
        val refreshToken = client.auth.currentSessionOrNull()?.refreshToken ?: return false
        val session = client.auth.refreshSession(refreshToken)
        client.auth.importSession(session)
        return true
    }

    suspend fun currentUser(): UserInfo {
        awaitReady()
        return client.auth.retrieveUserForCurrentSession(updateSession = true)
    }

    suspend fun clearSession() {
        awaitReady()
        client.auth.clearSession()
    }

    fun handleDeeplink(intent: Intent, onSession: (UserSession) -> Unit) {
        client.handleDeeplinks(intent) { session -> onSession(session) }
    }

    private suspend fun awaitReady() {
        client.auth.awaitInitialization()
    }

}
