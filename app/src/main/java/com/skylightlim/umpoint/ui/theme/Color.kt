package com.skylightlim.umpoint.ui.theme

import androidx.compose.ui.graphics.Color

// Fallback scheme for phones without dynamic colour (below Android 12): badminton court green.
internal val Green = Color(0xFF006D44)
internal val GreenContainer = Color(0xFF8EF7B4)
internal val OnGreenContainer = Color(0xFF002111)
internal val Sage = Color(0xFF4E6355)
internal val SageContainer = Color(0xFFD0E8D6)
internal val OnSageContainer = Color(0xFF0B1F14)
internal val Teal = Color(0xFF3A6471)
internal val TealContainer = Color(0xFFBEEAF9)
internal val OnTealContainer = Color(0xFF001F27)

internal val LightSurface = Color(0xFFF5FBF4)
internal val LightOnSurface = Color(0xFF171D19)
internal val LightOnSurfaceVariant = Color(0xFF404943)
internal val LightOutline = Color(0xFF707972)
internal val LightOutlineVariant = Color(0xFFC0C9C1)

internal val DarkSurface = Color(0xFF0F1511)
internal val DarkOnSurface = Color(0xFFDFE4DE)
internal val DarkOnSurfaceVariant = Color(0xFFC0C9C1)
internal val DarkOutline = Color(0xFF8A938C)
internal val DarkOutlineVariant = Color(0xFF404943)

/**
 * What a court or a snipe means. These never follow the wallpaper, so free, yours and armed look
 * the same on every phone. Read through [LocalCourtColors], and always pair them with a label.
 */
data class CourtColors(
    val free: Color,
    val freeContainer: Color,
    val onFreeContainer: Color,
    val mine: Color,
    val mineContainer: Color,
    val onMineContainer: Color,
    val armed: Color,
    val onArmed: Color,
    val armedContainer: Color,
    val onArmedContainer: Color,
)

internal val LightCourts = CourtColors(
    free = Color(0xFF006D44),
    freeContainer = Color(0xFF8EF7B4),
    onFreeContainer = Color(0xFF002111),
    mine = Color(0xFF00639B),
    mineContainer = Color(0xFFD0E4FF),
    onMineContainer = Color(0xFF001D32),
    armed = Color(0xFF7B5800),
    onArmed = Color.White,
    armedContainer = Color(0xFFFFDEA1),
    onArmedContainer = Color(0xFF261900),
)

internal val DarkCourts = CourtColors(
    free = Color(0xFF70DA9A),
    freeContainer = Color(0xFF005232),
    onFreeContainer = Color(0xFF8EF7B4),
    mine = Color(0xFF96CCFF),
    mineContainer = Color(0xFF004B76),
    onMineContainer = Color(0xFFD0E4FF),
    armed = Color(0xFFF5BF46),
    onArmed = Color(0xFF412D00),
    armedContainer = Color(0xFF5D4200),
    onArmedContainer = Color(0xFFFFDEA1),
)
