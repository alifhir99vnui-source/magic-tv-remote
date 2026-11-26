package com.aluqabi.cinema.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aluqabi.cinema.data.repository.AuthRepository
import com.aluqabi.cinema.data.repository.AuthResult
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AuthTab { SIGN_IN, SIGN_UP, PHONE_OTP }

data class AuthUiState(
    val activeTab: AuthTab = AuthTab.SIGN_IN,
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val phone: String = "",
    val otpEntered: String = "",
    val otpSent: Boolean = false,
    val otpCountdownSec: Int = 0,
    val isLoading: Boolean = false,
    val errorAr: String? = null,
    val errorEn: String? = null,
    val infoAr: String? = null,
    val infoEn: String? = null
)

class AuthViewModel(private val authRepository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    private var timerJob: Job? = null

    fun selectTab(tab: AuthTab) { _uiState.update { it.copy(activeTab = tab, errorAr = null, errorEn = null, infoAr = null, infoEn = null) } }
    fun updateName(v: String) = _uiState.update { it.copy(name = v, errorAr = null, errorEn = null) }
    fun updateEmail(v: String) = _uiState.update { it.copy(email = v, errorAr = null, errorEn = null) }
    fun updatePassword(v: String) = _uiState.update { it.copy(password = v, errorAr = null, errorEn = null) }
    fun updateConfirmPassword(v: String) = _uiState.update { it.copy(confirmPassword = v, errorAr = null, errorEn = null) }
    fun updatePhone(v: String) = _uiState.update { it.copy(phone = v, errorAr = null, errorEn = null) }
    fun updateOtpEntered(v: String) = _uiState.update { it.copy(otpEntered = v.filter { c -> c.isDigit() }.take(6), errorAr = null, errorEn = null) }

    private fun handleResult(res: AuthResult) {
        when (res) {
            is AuthResult.Success -> _uiState.update { it.copy(isLoading = false) }
            is AuthResult.Error -> _uiState.update { it.copy(isLoading = false, errorAr = res.messageAr, errorEn = res.messageEn) }
            is AuthResult.Info -> _uiState.update { it.copy(isLoading = false, infoAr = res.messageAr, infoEn = res.messageEn) }
        }
    }

    fun submitEmailSignIn() {
        val s = _uiState.value
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.signInWithEmail(s.email, s.password)) }
    }

    fun submitEmailSignUp() {
        val s = _uiState.value
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.signUpWithEmail(s.name, s.email, s.password, s.confirmPassword)) }
    }

    fun requestPhoneOtp() {
        val phone = _uiState.value.phone
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }
            when (val res = authRepository.sendPhoneOtp(phone)) {
                is AuthResult.Info -> {
                    _uiState.update { it.copy(isLoading = false, otpSent = true, otpCountdownSec = 60, infoAr = res.messageAr, infoEn = res.messageEn) }
                    startTimer()
                }
                is AuthResult.Error -> _uiState.update { it.copy(isLoading = false, errorAr = res.messageAr, errorEn = res.messageEn) }
                is AuthResult.Success -> _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.otpCountdownSec > 0) { delay(1000); _uiState.update { c -> c.copy(otpCountdownSec = (c.otpCountdownSec - 1).coerceAtLeast(0)) } }
        }
    }

    fun verifyPhoneOtp() {
        val s = _uiState.value
        viewModelScope.launch { _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null, infoAr = null, infoEn = null) }; handleResult(authRepository.verifyPhoneOtp(s.phone, s.otpEntered, s.name)) }
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
