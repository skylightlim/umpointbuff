package com.skylightlim.umpoint.ui.theme

import android.os.Build
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightScheme = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = GreenContainer,
    onPrimaryContainer = OnGreenContainer,
    inversePrimary = Color(0xFF70DA9A),
    secondary = Sage,
    onSecondary = Color.White,
    secondaryContainer = SageContainer,
    onSecondaryContainer = OnSageContainer,
    tertiary = Teal,
    onTertiary = Color.White,
    tertiaryContainer = TealContainer,
    onTertiaryContainer = OnTealContainer,
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = LightSurface,
    onBackground = LightOnSurface,
    surface = LightSurface,
    onSurface = LightOnSurface,
    surfaceVariant = Color(0xFFE0E2E8),
    onSurfaceVariant = LightOnSurfaceVariant,
    surfaceTint = Green,
    inverseSurface = Color(0xFF2D3136),
    inverseOnSurface = Color(0xFFEFF1F7),
    outline = LightOutline,
    outlineVariant = LightOutlineVariant,
    scrim = Color.Black,
    surfaceBright = LightSurface,
    surfaceDim = Color(0xFFD7DADF),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF2F4F9),
    surfaceContainer = Color(0xFFECEEF4),
    surfaceContainerHigh = Color(0xFFE6E8EE),
    surfaceContainerHighest = Color(0xFFE0E2E8),
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF70DA9A),
    onPrimary = Color(0xFF003920),
    primaryContainer = Color(0xFF005232),
    onPrimaryContainer = GreenContainer,
    inversePrimary = Green,
    secondary = Color(0xFFB5CCBA),
    onSecondary = Color(0xFF213528),
    secondaryContainer = Color(0xFF374B3E),
    onSecondaryContainer = SageContainer,
    tertiary = Color(0xFFA2CEDD),
    onTertiary = Color(0xFF033541),
    tertiaryContainer = Color(0xFF214C59),
    onTertiaryContainer = TealContainer,
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = DarkSurface,
    onBackground = DarkOnSurface,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = Color(0xFF42474E),
    onSurfaceVariant = DarkOnSurfaceVariant,
    surfaceTint = Color(0xFF70DA9A),
    inverseSurface = DarkOnSurface,
    inverseOnSurface = Color(0xFF2D3136),
    outline = DarkOutline,
    outlineVariant = DarkOutlineVariant,
    scrim = Color.Black,
    surfaceBright = Color(0xFF363A3F),
    surfaceDim = DarkSurface,
    surfaceContainerLowest = Color(0xFF0B0F13),
    surfaceContainerLow = Color(0xFF181C20),
    surfaceContainer = Color(0xFF1D2025),
    surfaceContainerHigh = Color(0xFF272A2F),
    surfaceContainerHighest = Color(0xFF32353A),
)

/**
 * Far springier than Material's own expressive scheme: everything that moves, resizes or changes
 * shape overshoots. Colour and opacity can't overshoot, so the effects springs don't bounce.
 */
val BouncyMotion = object : MotionScheme {
    override fun <T> defaultSpatialSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.48f, stiffness = 520f)
    override fun <T> fastSpatialSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.42f, stiffness = 1100f)
    override fun <T> slowSpatialSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.55f, stiffness = 240f)
    override fun <T> defaultEffectsSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 1600f)
    override fun <T> fastEffectsSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 3800f)
    override fun <T> slowEffectsSpec(): FiniteAnimationSpec<T> = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 800f)
}

/**
 * For a whole page changing. A page is too big to bounce: buttons, the dock and hero moments keep
 * [BouncyMotion], and pages only settle with the faintest give.
 */
fun <T> pageSpring(): FiniteAnimationSpec<T> = spring(dampingRatio = 0.92f, stiffness = 420f)

val LocalCourtColors = staticCompositionLocalOf { LightCourts }

@Composable
fun UmpointTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 && darkTheme -> dynamicDarkColorScheme(context)
        Build.VERSION.SDK_INT >= 31 -> dynamicLightColorScheme(context)
        darkTheme -> DarkScheme
        else -> LightScheme
    }
    CompositionLocalProvider(LocalCourtColors provides if (darkTheme) DarkCourts else LightCourts) {
        MaterialExpressiveTheme(
            colorScheme = scheme,
            motionScheme = BouncyMotion,
            typography = UmpointTypography,
            shapes = UmpointShapes,
            content = content,
        )
    }
}
