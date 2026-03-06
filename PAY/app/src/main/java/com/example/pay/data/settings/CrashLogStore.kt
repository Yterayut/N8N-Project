package com.example.pay.data.settings

import android.content.Context
import com.example.pay.domain.CrashInfo

class CrashLogStore(context: Context) {
    private val prefs = context.getSharedPreferences("crash_log", Context.MODE_PRIVATE)

    fun record(throwable: Throwable) {
        prefs.edit()
            .putString(KEY_MESSAGE, throwable.stackTraceToString().take(4000))
            .putLong(KEY_TIMESTAMP, System.currentTimeMillis())
            .apply()
    }

    fun read(): CrashInfo = CrashInfo(
        message = prefs.getString(KEY_MESSAGE, "").orEmpty(),
        timestamp = prefs.getLong(KEY_TIMESTAMP, 0L)
    )

    fun clear() {
        prefs.edit().clear().apply()
    }

    private companion object {
        const val KEY_MESSAGE = "message"
        const val KEY_TIMESTAMP = "timestamp"
    }
}
