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

enum class AuthTab {
    SIGN_IN,
    SIGN_UP,
    PHONE_OTP
}

data class AuthUiState(
    val activeTab: AuthTab = AuthTab.SIGN_IN,
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val phone: String = "",
    val otpEntered: String = "",
    val generatedOtp: String? = null,
    val otpCountdownSec: Int = 0,
    val isLoading: Boolean = false,
    val errorAr: String? = null,
    val errorEn: String? = null
)

class AuthViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null

    fun selectTab(tab: AuthTab) {
        _uiState.update { it.copy(activeTab = tab, errorAr = null, errorEn = null) }
    }

    fun updateName(value: String) = _uiState.update { it.copy(name = value, errorAr = null, errorEn = null) }
    fun updateEmail(value: String) = _uiState.update { it.copy(email = value, errorAr = null, errorEn = null) }
    fun updatePassword(value: String) = _uiState.update { it.copy(password = value, errorAr = null, errorEn = null) }
    fun updateConfirmPassword(value: String) = _uiState.update { it.copy(confirmPassword = value, errorAr = null, errorEn = null) }
    fun updatePhone(value: String) = _uiState.update { it.copy(phone = value, errorAr = null, errorEn = null) }
    fun updateOtpEntered(value: String) {
        val digitsOnly = value.filter { it.isDigit() }.take(6)
        _uiState.update { it.copy(otpEntered = digitsOnly, errorAr = null, errorEn = null) }
    }

    fun submitEmailSignIn() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null) }
            when (val res = authRepository.signInWithEmail(state.email, state.password)) {
                is AuthResult.Success -> _uiState.update { it.copy(isLoading = false) }
                is AuthResult.Error -> _uiState.update {
                    it.copy(isLoading = false, errorAr = res.messageAr, errorEn = res.messageEn)
                }
            }
        }
    }

    fun submitEmailSignUp() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null) }
            when (
                val res = authRepository.signUpWithEmail(
                    name = state.name,
                    email = state.email,
                    password = state.password,
                    confirmPassword = state.confirmPassword
                )
            ) {
                is AuthResult.Success -> _uiState.update { it.copy(isLoading = false) }
                is AuthResult.Error -> _uiState.update {
                    it.copy(isLoading = false, errorAr = res.messageAr, errorEn = res.messageEn)
                }
            }
        }
    }

    fun requestLocalOtp() {
        val phone = _uiState.value.phone.trim().replace(" ", "").replace("-", "")
        if (!Regex("^\\+?[0-9]{8,15}$").matches(phone)) {
            _uiState.update {
                it.copy(
                    errorAr = "رقم الهاتف غير صالح (8 إلى 15 رقماً)",
                    errorEn = "Invalid phone number (8 to 15 digits)"
                )
            }
            return
        }
        val code = authRepository.generateLocalOtp()
        _uiState.update {
            it.copy(
                generatedOtp = code,
                otpCountdownSec = 60,
                errorAr = null,
                errorEn = null
            )
        }
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (_uiState.value.otpCountdownSec > 0) {
                delay(1000L)
                _uiState.update { current ->
                    current.copy(otpCountdownSec = (current.otpCountdownSec - 1).coerceAtLeast(0))
                }
            }
        }
    }

    fun verifyPhoneOtp() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null) }
            when (
                val res = authRepository.signInWithPhoneOtp(
                    phone = state.phone,
                    displayName = state.name,
                    enteredCode = state.otpEntered,
                    expectedCode = state.generatedOtp.orEmpty()
                )
            ) {
                is AuthResult.Success -> _uiState.update { it.copy(isLoading = false) }
                is AuthResult.Error -> _uiState.update {
                    it.copy(isLoading = false, errorAr = res.messageAr, errorEn = res.messageEn)
                }
            }
        }
    }

    fun quickSignIn(provider: String, displayName: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorAr = null, errorEn = null) }
            authRepository.quickSignIn(provider, displayName)
            _uiState.update { it.copy(isLoading = false) }
        }
    }

    class Factory(private val authRepository: AuthRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return AuthViewModel(authRepository) as T
        }
    }
}
