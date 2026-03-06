package com.example.pay

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.example.pay.ui.PayApp
import com.example.pay.ui.theme.PAYTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as PayApplication
        setContent {
            PAYTheme {
                PayApp(app.container)
            }
        }
    }
}
