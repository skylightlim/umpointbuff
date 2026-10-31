package com.skylightlim.umpoint.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.skylightlim.umpoint.R

private val WEIGHTS = listOf(400, 500, 600, 700, 800)

/** One weight of Google Sans Flex, set up the way Material Capsule uses it: 24 pt, normal width, not rounded. */
private fun flex(weight: Int) = Font(
    resId = R.font.google_sans_flex,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(
        FontVariation.weight(weight),
        FontVariation.Setting("opsz", 24f),
    ),
)

val SansFlex = FontFamily(WEIGHTS.map(::flex))

private fun TextStyle.sans() = copy(fontFamily = SansFlex, fontFeatureSettings = "tnum")
private fun TextStyle.heavy(weight: Int = 700) = sans().copy(fontWeight = FontWeight(weight))

/** Tracking belongs to a size: tight on big type, barely open on small. Material's defaults are wide for this font. */
private fun TextStyle.tracked(sp: Float) = copy(letterSpacing = sp.sp)

private val base = Typography()

val UmpointTypography = base.copy(
    displayLarge = base.displayLarge.heavy().tracked(-0.5f),
    displayMedium = base.displayMedium.heavy().tracked(-0.5f),
    displaySmall = base.displaySmall.heavy().tracked(-0.25f),
    headlineLarge = base.headlineLarge.heavy().tracked(-0.25f),
    headlineMedium = base.headlineMedium.copy(fontSize = 28.sp, lineHeight = 36.sp).heavy(600).tracked(-0.2f),
    headlineSmall = base.headlineSmall.sans(),
    titleLarge = base.titleLarge.sans(),
    titleMedium = base.titleMedium.sans().tracked(0.05f),
    titleSmall = base.titleSmall.sans().tracked(0.05f),
    bodyLarge = base.bodyLarge.sans().tracked(0.15f),
    bodyMedium = base.bodyMedium.sans().tracked(0.1f),
    bodySmall = base.bodySmall.sans().tracked(0.2f),
    labelLarge = base.labelLarge.sans().tracked(0.05f),
    labelMedium = base.labelMedium.sans().tracked(0.2f),
    labelSmall = base.labelSmall.sans().tracked(0.25f),
    displayLargeEmphasized = base.displayLargeEmphasized.heavy(800).tracked(-0.5f),
    displayMediumEmphasized = base.displayMediumEmphasized.heavy(800).tracked(-0.5f),
    displaySmallEmphasized = base.displaySmallEmphasized.heavy(800).tracked(-0.25f),
    headlineLargeEmphasized = base.headlineLargeEmphasized.heavy(800).tracked(-0.25f),
    headlineMediumEmphasized = base.headlineMediumEmphasized.heavy(600).tracked(-0.2f),
    headlineSmallEmphasized = base.headlineSmallEmphasized.heavy(600),
    titleLargeEmphasized = base.titleLargeEmphasized.copy(fontSize = 20.sp, lineHeight = 28.sp).heavy(600),
    titleMediumEmphasized = base.titleMediumEmphasized.sans().tracked(0.05f),
    titleSmallEmphasized = base.titleSmallEmphasized.sans().tracked(0.05f),
    bodyLargeEmphasized = base.bodyLargeEmphasized.sans().tracked(0.15f),
    bodyMediumEmphasized = base.bodyMediumEmphasized.sans().tracked(0.1f),
    bodySmallEmphasized = base.bodySmallEmphasized.sans().tracked(0.2f),
    labelLargeEmphasized = base.labelLargeEmphasized.sans().tracked(0.05f),
    labelMediumEmphasized = base.labelMediumEmphasized.sans().tracked(0.2f),
    labelSmallEmphasized = base.labelSmallEmphasized.sans().tracked(0.25f),
)
