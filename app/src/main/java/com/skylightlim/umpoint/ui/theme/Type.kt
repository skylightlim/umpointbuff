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

private val base = Typography()

val UmpointTypography = base.copy(
    displayLarge = base.displayLarge.heavy(),
    displayMedium = base.displayMedium.heavy(),
    displaySmall = base.displaySmall.heavy(),
    headlineLarge = base.headlineLarge.heavy(),
    headlineMedium = base.headlineMedium.copy(fontSize = 26.sp, lineHeight = 34.sp).heavy(600),
    headlineSmall = base.headlineSmall.sans(),
    titleLarge = base.titleLarge.sans(),
    titleMedium = base.titleMedium.sans(),
    titleSmall = base.titleSmall.sans(),
    bodyLarge = base.bodyLarge.sans(),
    bodyMedium = base.bodyMedium.sans(),
    bodySmall = base.bodySmall.sans(),
    labelLarge = base.labelLarge.sans(),
    labelMedium = base.labelMedium.sans(),
    labelSmall = base.labelSmall.sans(),
    displayLargeEmphasized = base.displayLargeEmphasized.heavy(800),
    displayMediumEmphasized = base.displayMediumEmphasized.heavy(800),
    displaySmallEmphasized = base.displaySmallEmphasized.heavy(800),
    headlineLargeEmphasized = base.headlineLargeEmphasized.heavy(800),
    headlineMediumEmphasized = base.headlineMediumEmphasized.sans(),
    headlineSmallEmphasized = base.headlineSmallEmphasized.sans(),
    titleLargeEmphasized = base.titleLargeEmphasized.copy(fontSize = 20.sp, lineHeight = 28.sp).heavy(600),
    titleMediumEmphasized = base.titleMediumEmphasized.sans(),
    titleSmallEmphasized = base.titleSmallEmphasized.sans(),
    bodyLargeEmphasized = base.bodyLargeEmphasized.sans(),
    bodyMediumEmphasized = base.bodyMediumEmphasized.sans(),
    bodySmallEmphasized = base.bodySmallEmphasized.sans(),
    labelLargeEmphasized = base.labelLargeEmphasized.sans(),
    labelMediumEmphasized = base.labelMediumEmphasized.sans(),
    labelSmallEmphasized = base.labelSmallEmphasized.sans(),
)
