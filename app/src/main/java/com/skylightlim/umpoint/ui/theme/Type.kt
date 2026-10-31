package com.skylightlim.umpoint.ui.theme

import android.os.Build
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.skylightlim.umpoint.R

private const val WIDE = 151f
private val WEIGHTS = listOf(400, 500, 600, 700, 800)

/** One rounded instance of Google Sans Flex. Wide widths render wrongly before Android 12. */
private fun flex(weight: Int, width: Float) = Font(
    resId = R.font.google_sans_flex,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(
        FontVariation.weight(weight),
        FontVariation.width(if (Build.VERSION.SDK_INT >= 31) width else 100f),
        FontVariation.Setting("ROND", 100f),
    ),
)

/** Rounded Google Sans Flex for everything routine. */
val SansFlex = FontFamily(WEIGHTS.map { flex(it, 100f) })

/** The same face stretched wide, for hero numbers, screen titles and step titles. */
val WideFlex = FontFamily(WEIGHTS.map { flex(it, WIDE) })

private fun TextStyle.sans() = copy(fontFamily = SansFlex, fontFeatureSettings = "tnum")
private fun TextStyle.wide(weight: Int = 700) =
    copy(fontFamily = WideFlex, fontWeight = FontWeight(weight), fontFeatureSettings = "tnum")

private val base = Typography()

val UmpointTypography = base.copy(
    displayLarge = base.displayLarge.wide(),
    displayMedium = base.displayMedium.wide(),
    displaySmall = base.displaySmall.wide(),
    headlineLarge = base.headlineLarge.wide(),
    headlineMedium = base.headlineMedium.copy(fontSize = 26.sp, lineHeight = 34.sp).wide(600),
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
    displayLargeEmphasized = base.displayLargeEmphasized.wide(800),
    displayMediumEmphasized = base.displayMediumEmphasized.wide(800),
    displaySmallEmphasized = base.displaySmallEmphasized.wide(800),
    headlineLargeEmphasized = base.headlineLargeEmphasized.wide(800),
    headlineMediumEmphasized = base.headlineMediumEmphasized.sans(),
    headlineSmallEmphasized = base.headlineSmallEmphasized.sans(),
    titleLargeEmphasized = base.titleLargeEmphasized.copy(fontSize = 20.sp, lineHeight = 28.sp).wide(600),
    titleMediumEmphasized = base.titleMediumEmphasized.sans(),
    titleSmallEmphasized = base.titleSmallEmphasized.sans(),
    bodyLargeEmphasized = base.bodyLargeEmphasized.sans(),
    bodyMediumEmphasized = base.bodyMediumEmphasized.sans(),
    bodySmallEmphasized = base.bodySmallEmphasized.sans(),
    labelLargeEmphasized = base.labelLargeEmphasized.sans(),
    labelMediumEmphasized = base.labelMediumEmphasized.sans(),
    labelSmallEmphasized = base.labelSmallEmphasized.sans(),
)
