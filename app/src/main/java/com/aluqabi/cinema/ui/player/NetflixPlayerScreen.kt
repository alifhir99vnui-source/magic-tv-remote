package com.aluqabi.cinema.ui.player

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.content.pm.ActivityInfo
import android.media.AudioManager
import android.net.Uri
import android.provider.Settings
import android.util.TypedValue
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.AspectRatio
import androidx.compose.material.icons.rounded.BrightnessHigh
import androidx.compose.material.icons.rounded.ClosedCaption
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Forward10
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.automirrored.rounded.PlaylistPlay
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.ScreenRotation
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.CaptionStyleCompat
import androidx.media3.ui.PlayerView
import com.aluqabi.cinema.data.local.AppPreferences
import com.aluqabi.cinema.data.source.SubtitleCue
import com.aluqabi.cinema.data.source.SubtitleParser
import com.aluqabi.cinema.domain.model.MediaType
import com.aluqabi.cinema.domain.model.PlayerEpisodeEntry
import com.aluqabi.cinema.domain.model.PlayerLaunchRequest
import com.aluqabi.cinema.domain.model.StreamQualityOption
import com.aluqabi.cinema.domain.model.SubtitleTrackOption
import com.aluqabi.cinema.ui.i18n.AppStrings
import com.aluqabi.cinema.ui.theme.CinemaRed
import com.aluqabi.cinema.ui.theme.TextPrimary
import com.aluqabi.cinema.ui.theme.TextSecondary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private enum class GestureAxis {
    NONE,
    PINCH,
    EDGE_LEFT_BRIGHTNESS,
    EDGE_RIGHT_VOLUME
}

@OptIn(UnstableApi::class)
@Composable
fun NetflixPlayerScreen(
    request: PlayerLaunchRequest,
    strings: AppStrings,
    preferences: AppPreferences,
    okHttpClient: OkHttpClient,
    isInPipMode: Boolean,
    onEnterPip: () -> Unit,
    onSaveProgress: (PlayerLaunchRequest, String, Long, Long) -> Unit,
    onUpdateSubtitlePrefs: (Float, Long, Long) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val audioManager = remember(context) {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    val scope = rememberCoroutineScope()

    var activeRequest by remember(request) { mutableStateOf(request) }
    var activeStreamOption by remember(request) {
        mutableStateOf(
            request.streamOptions.firstOrNull()
                ?: StreamQualityOption("Default", "")
        )
    }

    var isPlaying by remember { mutableStateOf(true) }
    var isBuffering by remember { mutableStateOf(true) }
    var playerError by remember { mutableStateOf<String?>(null) }

    var currentPositionMs by remember { mutableLongStateOf(request.initialPositionMs) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var bufferedPositionMs by remember { mutableLongStateOf(0L) }
    var isScrubbing by remember { mutableStateOf(false) }
    var scrubPositionMs by remember { mutableLongStateOf(0L) }

    var controlsVisible by remember { mutableStateOf(true) }
    var isLocked by remember { mutableStateOf(false) }
    var lockedHintVisible by remember { mutableStateOf(false) }
    var activeSheet by remember { mutableStateOf(PlayerSheet.NONE) }

    var aspectMode by remember {
        mutableStateOf(
            runCatching { PlayerAspectMode.valueOf(preferences.defaultAspectMode) }
                .getOrDefault(PlayerAspectMode.FIT)
        )
    }
    var pinchScale by remember { mutableFloatStateOf(1f) }
    var playbackSpeed by remember { mutableFloatStateOf(1f) }
    var isLandscape by remember { mutableStateOf(true) }

    // Seek animation overlays
    var seekBurstText by remember { mutableStateOf<String?>(null) }
    var seekBurstLeft by remember { mutableStateOf(false) }
    var seekBurstToken by remember { mutableIntStateOf(0) }

    // Edge HUD states
    var activeEdgeHud by remember { mutableStateOf<EdgeHudType?>(null) }
    val initialBrightnessFraction = remember(activity, context) { readInitialBrightness(activity, context) }
    var brightnessFraction by remember { mutableFloatStateOf(initialBrightnessFraction) }
    val maxVolume = remember { audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }
    var volumeFraction by remember {
        mutableFloatStateOf(
            audioManager.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / maxVolume.toFloat()
        )
    }

    // Track lists
    var adaptiveQualities by remember { mutableStateOf<List<VideoQualityTrack>>(emptyList()) }
    var isAutoQuality by remember { mutableStateOf(true) }
    var audioTracks by remember { mutableStateOf<List<AudioTrackItem>>(emptyList()) }
    var embeddedSubtitles by remember { mutableStateOf<List<EmbeddedSubtitleTrack>>(emptyList()) }

    // Subtitles state
    val externalSubtitlesList = remember(activeRequest) {
        mutableStateListOf<SubtitleTrackOption>().apply {
            addAll(activeRequest.externalSubtitles)
        }
    }
    var selectedSubtitleId by remember { mutableStateOf<String?>(null) }
    var activeExternalCues by remember { mutableStateOf<List<SubtitleCue>>(emptyList()) }
    var subtitleFontSize by remember(preferences.subtitleFontSizeSp) {
        mutableFloatStateOf(preferences.subtitleFontSizeSp)
    }
    var subtitleTextColor by remember(preferences.subtitleTextColorArgb) {
        mutableLongStateOf(preferences.subtitleTextColorArgb)
    }
    var subtitleBgColor by remember(preferences.subtitleBgColorArgb) {
        mutableLongStateOf(preferences.subtitleBgColorArgb)
    }
    var subtitleSyncOffsetMs by remember { mutableLongStateOf(0L) }

    val currentRequest by rememberUpdatedState(activeRequest)
    val currentStreamOption by rememberUpdatedState(activeStreamOption)
    val currentIsScrubbing by rememberUpdatedState(isScrubbing)
    val currentBrightnessFraction by rememberUpdatedState(brightnessFraction)
    val currentVolumeFraction by rememberUpdatedState(volumeFraction)
    val currentPinchScale by rememberUpdatedState(pinchScale)
    val currentControlsVisible by rememberUpdatedState(controlsVisible)

    val trackSelector = remember { DefaultTrackSelector(context) }
    val exoPlayer = remember {
        ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .build()
    }

    var playerViewRef by remember { mutableStateOf<PlayerView?>(null) }

    fun showSeekBurst(text: String, left: Boolean) {
        seekBurstText = text
        seekBurstLeft = left
        seekBurstToken++
    }

    // Helper to load external SRT/VTT content
    fun loadExternalSubtitle(option: SubtitleTrackOption) {
        scope.launch {
            val content = withContext(Dispatchers.IO) {
                runCatching {
                    if (option.url.startsWith("content://") || option.url.startsWith("file://")) {
                        context.contentResolver.openInputStream(Uri.parse(option.url))
                            ?.bufferedReader()?.use { it.readText() }.orEmpty()
                    } else {
                        val req = Request.Builder().url(option.url).build()
                        okHttpClient.newCall(req).execute().use { it.body?.string().orEmpty() }
                    }
                }.getOrDefault("")
            }
            if (content.isNotBlank()) {
                activeExternalCues = SubtitleParser.parse(content)
                selectedSubtitleId = "ext_${option.url}"
                // Disable embedded subtitle renderer while external cues are active
                exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                    .buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
            }
        }
    }

    val subtitleFilePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            val option = SubtitleTrackOption(
                label = uri.lastPathSegment?.substringAfterLast('/') ?: "Local Subtitle",
                language = "ar",
                url = uri.toString()
            )
            externalSubtitlesList.add(option)
            loadExternalSubtitle(option)
        }
    }

    // Auto-load first external subtitle if provided with the stream
    LaunchedEffect(activeRequest.mediaKey) {
        val firstExt = activeRequest.externalSubtitles.firstOrNull()
        if (firstExt != null) {
            loadExternalSubtitle(firstExt)
        } else {
            activeExternalCues = emptyList()
            selectedSubtitleId = null
        }
    }

    // Load media item whenever active stream URL changes
    LaunchedEffect(activeStreamOption.url, activeRequest.mediaKey) {
        if (activeStreamOption.url.isNotBlank()) {
            playerError = null
            isBuffering = true
            val mediaItem = MediaItem.fromUri(activeStreamOption.url)
            exoPlayer.setMediaItem(mediaItem)
            if (activeRequest.initialPositionMs > 0L && activeRequest.mediaType != MediaType.LIVE_TV) {
                exoPlayer.seekTo(activeRequest.initialPositionMs)
            }
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true
        }
    }

    // Immersive fullscreen & orientation handling
    DisposableEffect(activity, activeRequest.mediaKey) {
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        val window = activity?.window
        if (window != null) {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            if (window != null) {
                WindowCompat.setDecorFitsSystemWindows(window, true)
                WindowInsetsControllerCompat(window, window.decorView)
                    .show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    DisposableEffect(activity) {
        onDispose {
            onSaveProgress(
                currentRequest,
                currentStreamOption.url,
                exoPlayer.currentPosition,
                exoPlayer.duration.coerceAtLeast(0L)
            )
            applyWindowBrightness(activity, initialBrightnessFraction)
            exoPlayer.release()
        }
    }

    // Player listener for playback state, tracks, and errors
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                isBuffering = playbackState == Player.STATE_BUFFERING
                if (playbackState == Player.STATE_READY) {
                    durationMs = exoPlayer.duration.coerceAtLeast(0L)
                }
            }

            override fun onTracksChanged(tracks: Tracks) {
                val videoList = mutableListOf<VideoQualityTrack>()
                val audioList = mutableListOf<AudioTrackItem>()
                val textList = mutableListOf<EmbeddedSubtitleTrack>()

                for (group in tracks.groups) {
                    when (group.type) {
                        C.TRACK_TYPE_VIDEO -> {
                            for (i in 0 until group.length) {
                                if (!group.isTrackSupported(i)) continue
                                val fmt = group.getTrackFormat(i)
                                val height = fmt.height
                                val label = if (height > 0) "${height}p" else "Video ${videoList.size + 1}"
                                videoList += VideoQualityTrack(
                                    id = "v_${group.mediaTrackGroup.hashCode()}_$i",
                                    label = label,
                                    height = height,
                                    bitrate = fmt.bitrate,
                                    isSelected = group.isTrackSelected(i),
                                    trackGroup = group.mediaTrackGroup,
                                    trackIndex = i
                                )
                            }
                        }
                        C.TRACK_TYPE_AUDIO -> {
                            for (i in 0 until group.length) {
                                if (!group.isTrackSupported(i)) continue
                                val fmt = group.getTrackFormat(i)
                                val lang = fmt.language ?: "und"
                                val label = fmt.label?.takeIf { it.isNotBlank() }
                                    ?: Locale(lang).displayLanguage.ifBlank { "Audio ${audioList.size + 1}" }
                                audioList += AudioTrackItem(
                                    id = "a_${group.mediaTrackGroup.hashCode()}_$i",
                                    label = label,
                                    language = lang,
                                    isSelected = group.isTrackSelected(i),
                                    trackGroup = group.mediaTrackGroup,
                                    trackIndex = i
                                )
                            }
                        }
                        C.TRACK_TYPE_TEXT -> {
                            for (i in 0 until group.length) {
                                if (!group.isTrackSupported(i)) continue
                                val fmt = group.getTrackFormat(i)
                                val lang = fmt.language ?: "und"
                                val label = fmt.label?.takeIf { it.isNotBlank() }
                                    ?: Locale(lang).displayLanguage.ifBlank { "Subtitle ${textList.size + 1}" }
                                textList += EmbeddedSubtitleTrack(
                                    id = "t_${group.mediaTrackGroup.hashCode()}_$i",
                                    label = label,
                                    language = lang,
                                    isSelected = group.isTrackSelected(i),
                                    trackGroup = group.mediaTrackGroup,
                                    trackIndex = i
                                )
                            }
                        }
                    }
                }
                adaptiveQualities = videoList.sortedByDescending { it.height }
                audioTracks = audioList
                embeddedSubtitles = textList
            }

            override fun onPlayerError(error: PlaybackException) {
                isBuffering = false
                playerError = error.localizedMessage ?: "Playback failed"
            }
        }
        exoPlayer.addListener(listener)
        onDispose { exoPlayer.removeListener(listener) }
    }

    // Periodic progress & watch history saving
    LaunchedEffect(exoPlayer, activeRequest.mediaKey) {
        var tick = 0
        while (true) {
            if (!currentIsScrubbing) {
                currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L)
            }
            durationMs = exoPlayer.duration.coerceAtLeast(0L)
            bufferedPositionMs = exoPlayer.bufferedPosition.coerceAtLeast(0L)
            tick++
            if (tick % 10 == 0 && currentPositionMs > 0L) {
                onSaveProgress(
                    currentRequest,
                    currentStreamOption.url,
                    currentPositionMs,
                    durationMs
                )
            }
            delay(500L)
        }
    }

    // Auto-hide controls after 3 seconds of inactivity
    LaunchedEffect(controlsVisible, isPlaying, isLocked, activeSheet) {
        if (controlsVisible && isPlaying && !isLocked && activeSheet == PlayerSheet.NONE) {
            delay(3000L)
            controlsVisible = false
        }
    }

    // Auto-hide lock pill & double-tap burst & edge HUD
    LaunchedEffect(lockedHintVisible) {
        if (lockedHintVisible) {
            delay(2500L)
            lockedHintVisible = false
        }
    }
    LaunchedEffect(seekBurstToken) {
        if (seekBurstText != null) {
            delay(650L)
            seekBurstText = null
        }
    }

    // Sync SubtitleView styling for embedded tracks
    LaunchedEffect(playerViewRef, subtitleFontSize, subtitleTextColor, subtitleBgColor) {
        playerViewRef?.subtitleView?.apply {
            setApplyEmbeddedStyles(false)
            setApplyEmbeddedFontSizes(false)
            setStyle(
                CaptionStyleCompat(
                    subtitleTextColor.toInt(),
                    subtitleBgColor.toInt(),
                    android.graphics.Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW,
                    android.graphics.Color.BLACK,
                    android.graphics.Typeface.DEFAULT_BOLD
                )
            )
            setFixedTextSize(TypedValue.COMPLEX_UNIT_SP, subtitleFontSize)
        }
    }

    BackHandler {
        if (activeSheet != PlayerSheet.NONE) {
            activeSheet = PlayerSheet.NONE
        } else if (isLocked) {
            lockedHintVisible = true
        } else {
            onClose()
        }
    }

    val touchSlop = LocalViewConfiguration.current.touchSlop

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
            val baseResizeMode = when (aspectMode) {
                PlayerAspectMode.FIT -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                PlayerAspectMode.FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                PlayerAspectMode.ZOOM -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                PlayerAspectMode.STRETCH -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            }
            val modeScale = if (aspectMode == PlayerAspectMode.ZOOM) 1.18f else 1f
            val totalScale = modeScale * pinchScale

            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        useController = false
                        keepScreenOn = true
                        player = exoPlayer
                        resizeMode = baseResizeMode
                        playerViewRef = this
                    }
                },
                update = { view ->
                    view.resizeMode = baseResizeMode
                },
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer(
                        scaleX = totalScale,
                        scaleY = totalScale
                    )
            )

            // External SRT/VTT subtitle renderer with exact millisecond sync
            val activeCueText = remember(activeExternalCues, currentPositionMs, subtitleSyncOffsetMs) {
                SubtitleParser.findCueAt(
                    cues = activeExternalCues,
                    positionMs = currentPositionMs,
                    offsetMs = subtitleSyncOffsetMs
                )
            }
            if (activeCueText.isNotBlank() && selectedSubtitleId?.startsWith("ext_") == true) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(
                            bottom = if (controlsVisible && !isInPipMode) 96.dp else 28.dp,
                            start = 24.dp,
                            end = 24.dp
                        )
                ) {
                    Text(
                        text = activeCueText,
                        color = Color(subtitleTextColor),
                        fontSize = subtitleFontSize.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .background(Color(subtitleBgColor), RoundedCornerShape(6.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Unified Gesture Layer: 1-finger edge swipe (Brightness Left / Volume Right),
            // 2-finger pinch-to-zoom, single-tap controls toggle, double-tap +/-10s
            if (!isInPipMode) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .pointerInput(isLocked, maxVolume) {
                            awaitEachGesture {
                                val firstDown = awaitFirstDown(requireUnconsumed = false)
                                val downPos = firstDown.position
                                var totalDx = 0f
                                var totalDy = 0f
                                var axis = GestureAxis.NONE

                                while (true) {
                                    val event = awaitPointerEvent()
                                    val pressed = event.changes.filter { it.pressed }
                                    if (pressed.isEmpty()) break

                                    if (pressed.size >= 2 && !isLocked) {
                                        axis = GestureAxis.PINCH
                                        val zoomChange = event.calculateZoom()
                                        if (zoomChange != 1f) {
                                            pinchScale = (currentPinchScale * zoomChange).coerceIn(1f, 3f)
                                            event.changes.forEach { it.consume() }
                                        }
                                    } else if (pressed.size == 1 && axis != GestureAxis.PINCH && !isLocked) {
                                        val change = pressed.first()
                                        val dx = change.position.x - change.previousPosition.x
                                        val dy = change.position.y - change.previousPosition.y
                                        totalDx += dx
                                        totalDy += dy

                                        if (axis == GestureAxis.NONE &&
                                            abs(totalDy) > touchSlop &&
                                            abs(totalDy) > abs(totalDx)
                                        ) {
                                            axis = when {
                                                downPos.x < size.width * 0.35f -> GestureAxis.EDGE_LEFT_BRIGHTNESS
                                                downPos.x > size.width * 0.65f -> GestureAxis.EDGE_RIGHT_VOLUME
                                                else -> GestureAxis.NONE
                                            }
                                        }

                                        when (axis) {
                                            GestureAxis.EDGE_LEFT_BRIGHTNESS -> {
                                                val delta = -dy / (size.height * 0.7f)
                                                val nextBrightness = (currentBrightnessFraction + delta).coerceIn(0.02f, 1f)
                                                brightnessFraction = nextBrightness
                                                applyWindowBrightness(activity, nextBrightness)
                                                activeEdgeHud = EdgeHudType.BRIGHTNESS
                                                change.consume()
                                            }
                                            GestureAxis.EDGE_RIGHT_VOLUME -> {
                                                val delta = -dy / (size.height * 0.7f)
                                                val nextVolume = (currentVolumeFraction + delta).coerceIn(0f, 1f)
                                                volumeFraction = nextVolume
                                                val targetVol = (nextVolume * maxVolume).roundToInt()
                                                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, 0)
                                                activeEdgeHud = EdgeHudType.VOLUME
                                                change.consume()
                                            }
                                            else -> Unit
                                        }
                                    }
                                }

                                activeEdgeHud = null

                                if (axis == GestureAxis.NONE && abs(totalDx) < touchSlop && abs(totalDy) < touchSlop) {
                                    if (isLocked) {
                                        lockedHintVisible = !lockedHintVisible
                                    } else {
                                        val secondTap = withTimeoutOrNull(230L) {
                                            awaitFirstDown(requireUnconsumed = false)
                                        }
                                        if (secondTap != null) {
                                            val tapX = secondTap.position.x
                                            when {
                                                tapX < size.width * 0.42f -> {
                                                    val target = (exoPlayer.currentPosition - 10_000L).coerceAtLeast(0L)
                                                    exoPlayer.seekTo(target)
                                                    showSeekBurst("-10s", left = true)
                                                }
                                                tapX > size.width * 0.58f -> {
                                                    val dur = exoPlayer.duration
                                                    val target = if (dur > 0L) {
                                                        (exoPlayer.currentPosition + 10_000L).coerceAtMost(dur)
                                                    } else {
                                                        exoPlayer.currentPosition + 10_000L
                                                    }
                                                    exoPlayer.seekTo(target)
                                                    showSeekBurst("+10s", left = false)
                                                }
                                                else -> {
                                                    if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                                                }
                                            }
                                        } else {
                                            controlsVisible = !currentControlsVisible
                                        }
                                    }
                                }
                            }
                        }
                )
            }

            // Buffering indicator
            if (isBuffering && playerError == null) {
                CircularProgressIndicator(
                    color = CinemaRed,
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            // Double-tap seek visual animation
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                AnimatedVisibility(
                    visible = seekBurstText != null,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier
                        .align(if (seekBurstLeft) Alignment.CenterStart else Alignment.CenterEnd)
                        .padding(horizontal = 48.dp)
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .background(Color.Black.copy(alpha = 0.65f), RoundedCornerShape(20.dp))
                            .padding(horizontal = 20.dp, vertical = 14.dp)
                    ) {
                        Icon(
                            imageVector = if (seekBurstLeft) Icons.Rounded.Replay10 else Icons.Rounded.Forward10,
                            contentDescription = null,
                            tint = TextPrimary,
                            modifier = Modifier.size(34.dp)
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = seekBurstText.orEmpty(),
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            // Vertical Edge Swipe HUD Slider (Brightness / Volume)
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                AnimatedVisibility(
                    visible = activeEdgeHud != null,
                    enter = fadeIn(),
                    exit = fadeOut(),
                    modifier = Modifier
                        .align(
                            if (activeEdgeHud == EdgeHudType.BRIGHTNESS) Alignment.CenterStart
                            else Alignment.CenterEnd
                        )
                        .padding(horizontal = 28.dp)
                ) {
                    val isBrightness = activeEdgeHud == EdgeHudType.BRIGHTNESS
                    val fraction = if (isBrightness) brightnessFraction else volumeFraction
                    val icon = when {
                        isBrightness -> Icons.Rounded.BrightnessHigh
                        fraction <= 0.01f -> Icons.AutoMirrored.Rounded.VolumeOff
                        else -> Icons.AutoMirrored.Rounded.VolumeUp
                    }
                    EdgeHudSlider(
                        icon = icon,
                        label = if (isBrightness) strings.brightnessLabel else strings.volumeLabel,
                        fraction = fraction
                    )
                }
            }

            // Error overlay
            if (playerError != null) {
                Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .background(Color.Black.copy(alpha = 0.85f), RoundedCornerShape(16.dp))
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Rounded.ErrorOutline,
                        contentDescription = null,
                        tint = CinemaRed,
                        modifier = Modifier.size(40.dp)
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = strings.playerErrorTitle,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = playerError.orEmpty(),
                        color = TextSecondary,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                playerError = null
                                exoPlayer.prepare()
                                exoPlayer.playWhenReady = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = CinemaRed)
                        ) {
                            Text(strings.retry, color = TextPrimary)
                        }
                        Button(
                            onClick = onClose,
                            colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)
                        ) {
                            Text(strings.cancel, color = TextPrimary)
                        }
                    }
                }
            }

            // Screen Locked floating unlock button
            AnimatedVisibility(
                visible = isLocked && lockedHintVisible && !isInPipMode,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 32.dp)
            ) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color.Black.copy(alpha = 0.78f))
                        .clickable {
                            isLocked = false
                            controlsVisible = true
                            lockedHintVisible = false
                        }
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.LockOpen,
                        contentDescription = strings.tapToUnlock,
                        tint = CinemaRed,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = strings.tapToUnlock,
                        color = TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp
                    )
                }
            }

            // Full Netflix-Style Controls Overlay (hidden when locked, PiP, or 3s timeout)
            AnimatedVisibility(
                visible = controlsVisible && !isLocked && !isInPipMode && playerError == null,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    Color.Black.copy(alpha = 0.72f),
                                    Color.Black.copy(alpha = 0.25f),
                                    Color.Black.copy(alpha = 0.82f)
                                )
                            )
                        )
                ) {
                    // TOP BAR
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onClose) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                                contentDescription = "Back",
                                tint = TextPrimary
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = activeRequest.title,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (activeRequest.subtitle.isNotBlank()) {
                                Text(
                                    text = activeRequest.subtitle,
                                    color = TextSecondary,
                                    fontSize = 12.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                        if (activeRequest.mediaType == MediaType.LIVE_TV) {
                            Row(
                                modifier = Modifier
                                    .background(CinemaRed, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = strings.liveBadge,
                                    color = TextPrimary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(Modifier.width(8.dp))
                        }
                        IconButton(onClick = onEnterPip) {
                            Icon(
                                imageVector = Icons.Rounded.PictureInPictureAlt,
                                contentDescription = strings.pipMode,
                                tint = TextPrimary
                            )
                        }
                        IconButton(onClick = {
                            isLandscape = !isLandscape
                            activity?.requestedOrientation = if (isLandscape) {
                                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                            } else {
                                ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                            }
                        }) {
                            Icon(
                                imageVector = Icons.Rounded.ScreenRotation,
                                contentDescription = strings.rotateScreen,
                                tint = TextPrimary
                            )
                        }
                    }

                    // CENTER CONTROLS (-10s, Play/Pause, +10s)
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalArrangement = Arrangement.spacedBy(34.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                val target = (exoPlayer.currentPosition - 10_000L).coerceAtLeast(0L)
                                exoPlayer.seekTo(target)
                            },
                            modifier = Modifier
                                .size(54.dp)
                                .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Replay10,
                                contentDescription = "-10s",
                                tint = TextPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        IconButton(
                            onClick = {
                                if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                            },
                            modifier = Modifier
                                .size(70.dp)
                                .background(CinemaRed.copy(alpha = 0.92f), CircleShape)
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow,
                                contentDescription = "Play/Pause",
                                tint = TextPrimary,
                                modifier = Modifier.size(40.dp)
                            )
                        }

                        IconButton(
                            onClick = {
                                val dur = exoPlayer.duration
                                val target = if (dur > 0L) {
                                    (exoPlayer.currentPosition + 10_000L).coerceAtMost(dur)
                                } else {
                                    exoPlayer.currentPosition + 10_000L
                                }
                                exoPlayer.seekTo(target)
                            },
                            modifier = Modifier
                                .size(54.dp)
                                .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.Forward10,
                                contentDescription = "+10s",
                                tint = TextPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }

                    // BOTTOM SEEKBAR + ACTION BAR
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        if (activeRequest.mediaType != MediaType.LIVE_TV && durationMs > 0L) {
                            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                                val displayedPos = if (isScrubbing) scrubPositionMs else currentPositionMs
                                val remainingMs = (durationMs - displayedPos).coerceAtLeast(0L)
                                val bufferFraction = (bufferedPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)

                                Box(modifier = Modifier.fillMaxWidth()) {
                                    // Subtle buffered progress bar behind the thumb slider
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(bufferFraction)
                                            .height(3.dp)
                                            .align(Alignment.CenterStart)
                                            .background(Color.White.copy(alpha = 0.35f), RoundedCornerShape(2.dp))
                                    )
                                    Slider(
                                        value = displayedPos.toFloat(),
                                        onValueChange = {
                                            isScrubbing = true
                                            scrubPositionMs = it.toLong()
                                        },
                                        onValueChangeFinished = {
                                            exoPlayer.seekTo(scrubPositionMs)
                                            currentPositionMs = scrubPositionMs
                                            isScrubbing = false
                                        },
                                        valueRange = 0f..durationMs.toFloat().coerceAtLeast(1f),
                                        colors = SliderDefaults.colors(
                                            thumbColor = CinemaRed,
                                            activeTrackColor = CinemaRed,
                                            inactiveTrackColor = Color.White.copy(alpha = 0.2f)
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = formatDurationMs(displayedPos),
                                        color = TextPrimary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = "-${formatDurationMs(remainingMs)}",
                                        color = TextSecondary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }

                        Spacer(Modifier.height(6.dp))

                        // Action Buttons Row (Zero Emojis - Material Icons + Crisp Labels)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            PlayerBottomAction(
                                icon = Icons.Rounded.Lock,
                                label = strings.screenLocked.substringBefore(" "),
                                onClick = {
                                    isLocked = true
                                    controlsVisible = false
                                    lockedHintVisible = true
                                }
                            )
                            PlayerBottomAction(
                                icon = Icons.Rounded.Speed,
                                label = "${playbackSpeed}x",
                                onClick = { activeSheet = PlayerSheet.SPEED }
                            )
                            PlayerBottomAction(
                                icon = Icons.Rounded.AspectRatio,
                                label = when (aspectMode) {
                                    PlayerAspectMode.FIT -> strings.aspectFit
                                    PlayerAspectMode.FILL -> strings.aspectFill
                                    PlayerAspectMode.ZOOM -> strings.aspectZoom
                                    PlayerAspectMode.STRETCH -> strings.aspectStretch
                                },
                                onClick = {
                                    pinchScale = 1f
                                    aspectMode = aspectMode.next()
                                }
                            )
                            PlayerBottomAction(
                                icon = Icons.Rounded.Tune,
                                label = strings.qualityTitle,
                                onClick = { activeSheet = PlayerSheet.QUALITY_AUDIO }
                            )
                            PlayerBottomAction(
                                icon = Icons.Rounded.ClosedCaption,
                                label = strings.subtitlesTitle,
                                onClick = { activeSheet = PlayerSheet.SUBTITLES }
                            )

                            if (activeRequest.episodesQueue.isNotEmpty()) {
                                PlayerBottomAction(
                                    icon = Icons.AutoMirrored.Rounded.PlaylistPlay,
                                    label = strings.episodesTitle,
                                    onClick = { activeSheet = PlayerSheet.EPISODES }
                                )
                                val parsedKey = parseEpisodeKey(activeRequest.mediaKey)
                                val nextEp = findNextEpisode(
                                    activeRequest.episodesQueue,
                                    activeRequest.seasonNumber ?: parsedKey?.first,
                                    activeRequest.episodeNumber ?: parsedKey?.second
                                )
                                if (nextEp != null) {
                                    PlayerBottomAction(
                                        icon = Icons.Rounded.SkipNext,
                                        label = strings.nextEpisode,
                                        onClick = {
                                            switchToEpisode(
                                                current = activeRequest,
                                                nextEp = nextEp,
                                                onUpdate = { updatedReq, streamOpt ->
                                                    onSaveProgress(
                                                        activeRequest,
                                                        activeStreamOption.url,
                                                        exoPlayer.currentPosition,
                                                        exoPlayer.duration.coerceAtLeast(0L)
                                                    )
                                                    activeRequest = updatedReq
                                                    activeStreamOption = streamOpt
                                                    isAutoQuality = true
                                                }
                                            )
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Overlay Sheets (Quality/Audio, Subtitles Manager, Speed, Episodes)
            when (activeSheet) {
                PlayerSheet.QUALITY_AUDIO -> {
                    val mergedQualities = remember(activeRequest.streamOptions, adaptiveQualities, activeStreamOption) {
                        if (activeRequest.streamOptions.size > 1) {
                            activeRequest.streamOptions.mapIndexed { index, opt ->
                                VideoQualityTrack(
                                    id = "ext_q_$index",
                                    label = opt.label,
                                    height = 0,
                                    bitrate = 0,
                                    isSelected = opt.url == activeStreamOption.url,
                                    externalUrl = opt.url
                                )
                            }
                        } else {
                            adaptiveQualities
                        }
                    }
                    QualityAndAudioSheet(
                        strings = strings,
                        qualities = mergedQualities,
                        isAutoQuality = isAutoQuality,
                        audioTracks = audioTracks,
                        onSelectAutoQuality = {
                            val firstStream = activeRequest.streamOptions.firstOrNull()
                            if (firstStream != null && firstStream.url.isNotBlank() && firstStream.url != activeStreamOption.url) {
                                val resumePos = exoPlayer.currentPosition
                                activeRequest = activeRequest.copy(initialPositionMs = resumePos)
                                activeStreamOption = firstStream
                            }
                            isAutoQuality = true
                            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                .buildUpon()
                                .clearOverridesOfType(C.TRACK_TYPE_VIDEO)
                                .build()
                            activeSheet = PlayerSheet.NONE
                        },
                        onSelectQuality = { track ->
                            if (track.externalUrl != null) {
                                val resumePos = exoPlayer.currentPosition
                                activeRequest = activeRequest.copy(initialPositionMs = resumePos)
                                activeStreamOption = StreamQualityOption(track.label, track.externalUrl)
                                isAutoQuality = track.externalUrl == activeRequest.streamOptions.firstOrNull()?.url
                            } else if (track.trackGroup != null && track.trackIndex >= 0) {
                                isAutoQuality = false
                                exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                    .buildUpon()
                                    .setOverrideForType(
                                        TrackSelectionOverride(track.trackGroup, track.trackIndex)
                                    )
                                    .build()
                            }
                            activeSheet = PlayerSheet.NONE
                        },
                        onSelectAudio = { audio ->
                            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                .buildUpon()
                                .setOverrideForType(TrackSelectionOverride(audio.trackGroup, audio.trackIndex))
                                .build()
                            activeSheet = PlayerSheet.NONE
                        },
                        onClose = { activeSheet = PlayerSheet.NONE }
                    )
                }

                PlayerSheet.SUBTITLES -> {
                    SubtitlesManagerSheet(
                        strings = strings,
                        embeddedSubtitles = embeddedSubtitles,
                        externalSubtitles = externalSubtitlesList,
                        selectedSubtitleId = selectedSubtitleId,
                        fontSizeSp = subtitleFontSize,
                        textColorArgb = subtitleTextColor,
                        bgColorArgb = subtitleBgColor,
                        syncOffsetMs = subtitleSyncOffsetMs,
                        onSelectOff = {
                            selectedSubtitleId = null
                            activeExternalCues = emptyList()
                            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                .buildUpon()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                                .build()
                            activeSheet = PlayerSheet.NONE
                        },
                        onSelectEmbedded = { track ->
                            activeExternalCues = emptyList()
                            selectedSubtitleId = track.id
                            exoPlayer.trackSelectionParameters = exoPlayer.trackSelectionParameters
                                .buildUpon()
                                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                                .setOverrideForType(TrackSelectionOverride(track.trackGroup, track.trackIndex))
                                .build()
                            activeSheet = PlayerSheet.NONE
                        },
                        onSelectExternal = { ext ->
                            loadExternalSubtitle(ext)
                            activeSheet = PlayerSheet.NONE
                        },
                        onPickLocalSubtitleFile = {
                            subtitleFilePicker.launch(arrayOf("*/*"))
                        },
                        onLoadSubtitleUrl = { url ->
                            val opt = SubtitleTrackOption(
                                label = url.substringAfterLast('/').ifBlank { "URL Subtitle" },
                                language = "ar",
                                url = url
                            )
                            externalSubtitlesList.add(opt)
                            loadExternalSubtitle(opt)
                        },
                        onFontSizeChange = {
                            subtitleFontSize = it
                            onUpdateSubtitlePrefs(it, subtitleTextColor, subtitleBgColor)
                        },
                        onTextColorChange = {
                            subtitleTextColor = it
                            onUpdateSubtitlePrefs(subtitleFontSize, it, subtitleBgColor)
                        },
                        onBgColorChange = {
                            subtitleBgColor = it
                            onUpdateSubtitlePrefs(subtitleFontSize, subtitleTextColor, it)
                        },
                        onSyncOffsetChange = { subtitleSyncOffsetMs = it },
                        onClose = { activeSheet = PlayerSheet.NONE }
                    )
                }

                PlayerSheet.SPEED -> {
                    PlaybackSpeedSheet(
                        strings = strings,
                        currentSpeed = playbackSpeed,
                        onSelectSpeed = { spd ->
                            playbackSpeed = spd
                            exoPlayer.playbackParameters = PlaybackParameters(spd)
                        },
                        onClose = { activeSheet = PlayerSheet.NONE }
                    )
                }

                PlayerSheet.EPISODES -> {
                    InPlayerEpisodesSheet(
                        strings = strings,
                        episodes = activeRequest.episodesQueue,
                        currentEpisodeNumber = activeRequest.episodeNumber,
                        onSelectEpisode = { ep ->
                            switchToEpisode(
                                current = activeRequest,
                                nextEp = ep,
                                onUpdate = { updatedReq, streamOpt ->
                                    onSaveProgress(
                                        activeRequest,
                                        activeStreamOption.url,
                                        exoPlayer.currentPosition,
                                        exoPlayer.duration.coerceAtLeast(0L)
                                    )
                                    activeRequest = updatedReq
                                    activeStreamOption = streamOpt
                                    isAutoQuality = true
                                }
                            )
                        },
                        onClose = { activeSheet = PlayerSheet.NONE }
                    )
                }

                PlayerSheet.NONE -> Unit
            }
        }
}

@Composable
private fun EdgeHudSlider(
    icon: ImageVector,
    label: String,
    fraction: Float
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(Color.Black.copy(alpha = 0.72f))
            .padding(horizontal = 14.dp, vertical = 14.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = TextPrimary,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.height(10.dp))
        Box(
            modifier = Modifier
                .width(6.dp)
                .height(120.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Color.White.copy(alpha = 0.24f)),
            contentAlignment = Alignment.BottomCenter
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(fraction.coerceIn(0f, 1f))
                    .background(CinemaRed, RoundedCornerShape(3.dp))
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = "${(fraction * 100f).roundToInt()}%",
            color = TextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun PlayerBottomAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            )
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = TextPrimary,
            modifier = Modifier.size(22.dp)
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = label,
            color = TextSecondary,
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private val episodeKeyRegex = Regex("""_s(-?\d+)_e(-?\d+)$""")

private fun parseEpisodeKey(key: String): Pair<Int, Int>? {
    val match = episodeKeyRegex.find(key) ?: return null
    val season = match.groupValues[1].toIntOrNull() ?: return null
    val episode = match.groupValues[2].toIntOrNull() ?: return null
    return season to episode
}

private fun seriesKeyWithoutEpisode(key: String): String =
    episodeKeyRegex.find(key)?.let { key.removeRange(it.range) } ?: key

private fun findNextEpisode(
    queue: List<PlayerEpisodeEntry>,
    currentSeason: Int?,
    currentEpisodeNumber: Int?
): PlayerEpisodeEntry? {
    if (queue.isEmpty() || currentSeason == null || currentEpisodeNumber == null) return null
    val idx = queue.indexOfFirst {
        it.seasonNumber == currentSeason && it.episodeNumber == currentEpisodeNumber
    }
    if (idx >= 0) return queue.getOrNull(idx + 1)
    return queue.firstOrNull {
        it.seasonNumber == currentSeason && it.episodeNumber > currentEpisodeNumber
    } ?: queue.firstOrNull { it.seasonNumber > currentSeason }
}

private fun switchToEpisode(
    current: PlayerLaunchRequest,
    nextEp: PlayerEpisodeEntry,
    onUpdate: (PlayerLaunchRequest, StreamQualityOption) -> Unit
) {
    val streams = nextEp.qualities.ifEmpty {
        listOf(StreamQualityOption("Auto", nextEp.streamUrl))
    }
    val nextStream = streams.firstOrNull() ?: return
    val baseSeriesKey = seriesKeyWithoutEpisode(current.mediaKey)
    val nextReq = current.copy(
        mediaKey = "${baseSeriesKey}_s${nextEp.seasonNumber}_e${nextEp.episodeNumber}",
        subtitle = "S${nextEp.seasonNumber} E${nextEp.episodeNumber} - ${nextEp.title}",
        streamOptions = streams,
        externalSubtitles = nextEp.subtitles,
        initialPositionMs = 0L,
        seasonNumber = nextEp.seasonNumber,
        episodeNumber = nextEp.episodeNumber
    )
    onUpdate(nextReq, nextStream)
}

private fun formatDurationMs(ms: Long): String {
    val totalSec = (ms / 1000L).coerceAtLeast(0L)
    val hours = totalSec / 3600L
    val mins = (totalSec % 3600L) / 60L
    val secs = totalSec % 60L
    return if (hours > 0L) {
        String.format(Locale.US, "%d:%02d:%02d", hours, mins, secs)
    } else {
        String.format(Locale.US, "%02d:%02d", mins, secs)
    }
}

private fun readInitialBrightness(activity: Activity?, context: Context): Float {
    val windowBrightness = activity?.window?.attributes?.screenBrightness ?: -1f
    if (windowBrightness in 0f..1f) return windowBrightness
    return runCatching {
        val sys = Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS)
        (sys / 255f).coerceIn(0.05f, 1f)
    }.getOrDefault(0.5f)
}

private fun applyWindowBrightness(activity: Activity?, fraction: Float) {
    val window = activity?.window ?: return
    val params = window.attributes
    params.screenBrightness = fraction.coerceIn(0.02f, 1f)
    window.attributes = params
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
