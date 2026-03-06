package com.example.pay.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Ink900,
    secondary = Gold500,
    tertiary = Sky500,
    background = Sand50,
    surface = White,
    onPrimary = White,
    onSecondary = Ink900,
    onBackground = Ink900,
    onSurface = Ink900,
    error = Rose500
)

private val DarkColors = darkColorScheme(
    primary = Sand100,
    secondary = Gold500,
    tertiary = Sky500,
    background = Ink900,
    surface = Ink700,
    onPrimary = Ink900,
    onSecondary = Ink900,
    onBackground = White,
    onSurface = White,
    error = Rose500
)

@Composable
fun PAYTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = PayTypography,
        content = content
    )
}
