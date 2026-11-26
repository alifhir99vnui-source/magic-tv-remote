package com.aluqabi.cinema.ui.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Movie
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Phone
import androidx.compose.material.icons.rounded.Pin
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaBackground
import com.aluqabi.cinema.ui.theme.CinemaInfoBlue
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.CinemaSurface
import com.aluqabi.cinema.ui.theme.CinemaSurfaceBorder
import com.aluqabi.cinema.ui.theme.CinemaSurfaceElevated
import com.aluqabi.cinema.ui.theme.TextMuted
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary

@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    strings: AppStrings,
    onToggleLanguage: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showPassword by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1A0608),
                        CinemaBackground,
                        CinemaBackground
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(
                    onClick = onToggleLanguage,
                    border = BorderStroke(1.dp, CinemaSurfaceBorder),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Public,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = if (strings.isArabic) "English" else "العربية",
                        color = TextPrimary,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(CinemaRed.copy(alpha = 0.16f), RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Rounded.Movie,
                    contentDescription = null,
                    tint = CinemaRed,
                    modifier = Modifier.size(34.dp)
                )
            }

            Spacer(Modifier.height(14.dp))

            Text(
                text = strings.appName,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = strings.authSubtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(24.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CinemaSurface),
                border = BorderStroke(1.dp, CinemaSurfaceBorder),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    val tabs = listOf(
                        AuthTab.SIGN_IN to strings.tabSignIn,
                        AuthTab.SIGN_UP to strings.tabSignUp,
                        AuthTab.PHONE_OTP to strings.tabPhoneOtp
                    )
                    TabRow(
                        selectedTabIndex = tabs.indexOfFirst { it.first == state.activeTab },
                        containerColor = CinemaSurfaceElevated,
                        contentColor = TextPrimary,
                        indicator = { tabPositions ->
                            val idx = tabs.indexOfFirst { it.first == state.activeTab }
                            TabRowDefaults.SecondaryIndicator(
                                modifier = Modifier.tabIndicatorOffset(tabPositions[idx]),
                                color = CinemaRed
                            )
                        }
                    ) {
                        tabs.forEach { (tab, label) ->
                            Tab(
                                selected = state.activeTab == tab,
                                onClick = { viewModel.selectTab(tab) },
                                text = {
                                    Text(
                                        text = label,
                                        fontSize = 13.sp,
                                        fontWeight = if (state.activeTab == tab) FontWeight.Bold else FontWeight.Medium,
                                        color = if (state.activeTab == tab) TextPrimary else TextSecondary
                                    )
                                }
                            )
                        }
                    }

                    Spacer(Modifier.height(18.dp))

                    val errorMsg = if (strings.isArabic) state.errorAr else state.errorEn
                    if (!errorMsg.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(CinemaRed.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = errorMsg,
                                color = Color(0xFFFF8A8A),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                        Spacer(Modifier.height(12.dp))
                    }

                    when (state.activeTab) {
                        AuthTab.SIGN_IN -> {
                            AuthTextField(
                                value = state.email,
                                onValueChange = viewModel::updateEmail,
                                label = strings.email,
                                leadingIcon = Icons.Rounded.Email,
                                keyboardType = KeyboardType.Email
                            )
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.password,
                                onValueChange = viewModel::updatePassword,
                                label = strings.password,
                                leadingIcon = Icons.Rounded.Lock,
                                isPassword = !showPassword,
                                trailingIcon = {
                                    IconButton(onClick = { showPassword = !showPassword }) {
                                        Icon(
                                            imageVector = if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                            contentDescription = null,
                                            tint = TextSecondary
                                        )
                                    }
                                }
                            )
                            Spacer(Modifier.height(18.dp))
                            PrimaryAuthButton(
                                text = strings.signInBtn,
                                isLoading = state.isLoading,
                                onClick = viewModel::submitEmailSignIn
                            )
                        }

                        AuthTab.SIGN_UP -> {
                            AuthTextField(
                                value = state.name,
                                onValueChange = viewModel::updateName,
                                label = strings.fullName,
                                leadingIcon = Icons.Rounded.Person
                            )
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.email,
                                onValueChange = viewModel::updateEmail,
                                label = strings.email,
                                leadingIcon = Icons.Rounded.Email,
                                keyboardType = KeyboardType.Email
                            )
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.password,
                                onValueChange = viewModel::updatePassword,
                                label = strings.password,
                                leadingIcon = Icons.Rounded.Lock,
                                isPassword = !showPassword,
                                trailingIcon = {
                                    IconButton(onClick = { showPassword = !showPassword }) {
                                        Icon(
                                            imageVector = if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                            contentDescription = null,
                                            tint = TextSecondary
                                        )
                                    }
                                }
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = strings.passwordHint,
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.confirmPassword,
                                onValueChange = viewModel::updateConfirmPassword,
                                label = strings.confirmPassword,
                                leadingIcon = Icons.Rounded.Lock,
                                isPassword = !showPassword
                            )
                            Spacer(Modifier.height(18.dp))
                            PrimaryAuthButton(
                                text = strings.createAccountBtn,
                                isLoading = state.isLoading,
                                onClick = viewModel::submitEmailSignUp
                            )
                        }

                        AuthTab.PHONE_OTP -> {
                            AuthTextField(
                                value = state.name,
                                onValueChange = viewModel::updateName,
                                label = strings.fullName,
                                leadingIcon = Icons.Rounded.Person
                            )
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.phone,
                                onValueChange = viewModel::updatePhone,
                                label = strings.phoneNumber,
                                leadingIcon = Icons.Rounded.Phone,
                                keyboardType = KeyboardType.Phone
                            )
                            Spacer(Modifier.height(10.dp))
                            OutlinedButton(
                                onClick = viewModel::requestLocalOtp,
                                enabled = state.otpCountdownSec == 0,
                                modifier = Modifier.fillMaxWidth(),
                                border = BorderStroke(1.dp, CinemaRed),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = if (state.otpCountdownSec > 0) {
                                        "${strings.resendOtpIn} ${state.otpCountdownSec}s"
                                    } else {
                                        strings.sendOtp
                                    },
                                    color = if (state.otpCountdownSec > 0) TextSecondary else CinemaRed,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            if (!state.generatedOtp.isNullOrBlank()) {
                                Spacer(Modifier.height(10.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(CinemaInfoBlue.copy(alpha = 0.14f), RoundedCornerShape(10.dp))
                                        .padding(10.dp)
                                ) {
                                    Text(
                                        text = "${strings.localOtpNotice} ${state.generatedOtp}",
                                        color = Color(0xFF93C5FD),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            AuthTextField(
                                value = state.otpEntered,
                                onValueChange = viewModel::updateOtpEntered,
                                label = strings.otpCode,
                                leadingIcon = Icons.Rounded.Pin,
                                keyboardType = KeyboardType.Number
                            )
                            Spacer(Modifier.height(18.dp))
                            PrimaryAuthButton(
                                text = strings.verifyAndEnter,
                                isLoading = state.isLoading,
                                onClick = viewModel::verifyPhoneOtp
                            )
                        }
                    }

                    Spacer(Modifier.height(20.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = CinemaSurfaceBorder)
                        Text(
                            text = strings.orContinueWith,
                            color = TextMuted,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 10.dp)
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), color = CinemaSurfaceBorder)
                    }

                    Spacer(Modifier.height(14.dp))

                    OutlinedButton(
                        onClick = {
                            viewModel.quickSignIn(
                                provider = "GOOGLE",
                                displayName = if (strings.isArabic) "حساب Google" else "Google User"
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        border = BorderStroke(1.dp, CinemaSurfaceBorder),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = CinemaSurfaceElevated),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.AccountCircle,
                            contentDescription = null,
                            tint = Color(0xFFEA4335),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = strings.continueWithGoogle,
                            color = TextPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(Modifier.height(10.dp))

                    OutlinedButton(
                        onClick = {
                            viewModel.quickSignIn(
                                provider = "FACEBOOK",
                                displayName = if (strings.isArabic) "حساب Facebook" else "Facebook User"
                            )
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        border = BorderStroke(1.dp, Color(0xFF1877F2).copy(alpha = 0.55f)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = Color(0xFF1877F2).copy(alpha = 0.14f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Public,
                            contentDescription = null,
                            tint = Color(0xFF60A5FA),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            text = strings.continueWithFacebook,
                            color = TextPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    leadingIcon: androidx.compose.ui.graphics.vector.ImageVector,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    trailingIcon: (@Composable () -> Unit)? = null
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 13.sp) },
        leadingIcon = {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                tint = TextSecondary
            )
        },
        trailingIcon = trailingIcon,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = CinemaRed,
            unfocusedBorderColor = CinemaSurfaceBorder,
            focusedContainerColor = CinemaSurfaceElevated,
            unfocusedContainerColor = CinemaSurfaceElevated,
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary,
            focusedLabelColor = CinemaRed,
            unfocusedLabelColor = TextSecondary
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun PrimaryAuthButton(
    text: String,
    isLoading: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = !isLoading,
        colors = ButtonDefaults.buttonColors(containerColor = CinemaRed),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = TextPrimary,
                strokeWidth = 2.dp,
                modifier = Modifier.size(22.dp)
            )
        } else {
            Text(
                text = text,
                color = TextPrimary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
