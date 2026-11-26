package com.aluqabi.cinema.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.AuthResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AuthTab { SIGN_IN, SIGN_UP }

data class AuthUiState(
    val activeTab: AuthTab = AuthTab.SIGN_IN,
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val oauthPending: Boolean = false,
    val errorAr: String? = null,
    val errorEn: String? = null,
    val infoAr: String? = null,
    val infoEn: String? = null
)

class AuthViewModel(private val authRepository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            authRepository.oauthResult.collect { result ->
                if (result == null) return@collect
                authRepository.consumeOAuthResult()
                if (_uiState.value.oauthPending) handleResult(result)
            }
        }
    }

    fun selectTab(tab: AuthTab) { _uiState.update { it.copy(activeTab = tab, errorAr = null, errorEn = null, infoAr = null, infoEn = null) } }
    fun updateName(v: String) = _uiState.update { it.copy(name = v, errorAr = null, errorEn = null) }
    fun updateEmail(v: String) = _uiState.update { it.copy(email = v, errorAr = null, errorEn = null) }
    fun updatePassword(v: String) = _uiState.update { it.copy(password = v, errorAr = null, errorEn = null) }
    fun updateConfirmPassword(v: String) = _uiState.update { it.copy(confirmPassword = v, errorAr = null, errorEn = null) }

    private fun handleResult(res: AuthResult) {
        when (res) {
            is AuthResult.Success -> _uiState.update { it.copy(isLoading = false, oauthPending = false) }
            is AuthResult.Error -> _uiState.update { it.copy(isLoading = false, oauthPending = false, errorAr = res.messageAr, errorEn = res.messageEn) }
            is AuthResult.Info -> _uiState.update { it.copy(isLoading = false, oauthPending = false, infoAr = res.messageAr, infoEn = res.messageEn) }
        }
    }

    fun signInWithFacebook() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, oauthPending = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }
            when (val res = authRepository.signInWithFacebook()) {
                is AuthResult.Info -> _uiState.update { it.copy(infoAr = res.messageAr, infoEn = res.messageEn) }
                else -> handleResult(res)
            }
        }
    }

    fun cancelOAuth() {
        _uiState.update {
            it.copy(
                isLoading = false,
                oauthPending = false,
                errorAr = "تم إلغاء تسجيل الدخول",
                errorEn = "Sign-in cancelled"
            )
        }
        authRepository.cancelOAuth()
    }

    fun submitEmailSignIn() {
        val s = _uiState.value
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.signInWithEmail(s.email, s.password)) }
    }

    fun submitEmailSignUp() {
        val s = _uiState.value
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.signUpWithEmail(s.name, s.email, s.password, s.confirmPassword)) }
    }

    fun signInWithGoogleIdToken(idToken: String) {
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.signInWithGoogleIdToken(idToken)) }
    }

    fun reportError(ar: String, en: String) { _uiState.update { it.copy(isLoading = false, errorAr = ar, errorEn = en) } }

    class Factory(private val authRepository: AuthRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = AuthViewModel(authRepository) as T
    }
}
