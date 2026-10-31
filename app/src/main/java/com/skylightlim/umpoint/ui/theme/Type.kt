package com.skylightlim.umpoint.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.skylightlim.umpoint.R

/** Wide, heavy face for hero numbers and hero titles only. Everything else stays Roboto. */
val ArchivoExpanded = FontFamily(
    Font(R.font.archivo_expanded_semibold, FontWeight.SemiBold),
    Font(R.font.archivo_expanded_bold, FontWeight.Bold),
)

private fun hero(size: Int, line: Int, tracking: Double) = TextStyle(
    fontFamily = ArchivoExpanded,
    fontWeight = FontWeight.Bold,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
    fontFeatureSettings = "tnum",
    platformStyle = PlatformTextStyle(includeFontPadding = false),
)

private val base = Typography()

val UmpointTypography = base.copy(
    displayLarge = hero(57, 64, -1.0),
    displayMedium = hero(45, 52, -0.5),
    displaySmall = hero(36, 44, -0.25),
)
