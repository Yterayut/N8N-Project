package com.example.pay.data.settings

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class AnalyticsEvent(
    val name: String,
    val detail: String,
    val timestamp: Long
)

class AnalyticsStore(context: Context) {
    private val prefs = context.getSharedPreferences("analytics_store", Context.MODE_PRIVATE)

    fun track(name: String, detail: String = "") {
        val current = read().toMutableList()
        current.add(
            0,
            AnalyticsEvent(
                name = name,
                detail = detail.take(180),
                timestamp = System.currentTimeMillis()
            )
        )
        val compact = current.take(40)
        val array = JSONArray()
        compact.forEach { event ->
            array.put(
                JSONObject()
                    .put("name", event.name)
                    .put("detail", event.detail)
                    .put("timestamp", event.timestamp)
            )
        }
        prefs.edit().putString(KEY_EVENTS, array.toString()).apply()
    }

    fun read(): List<AnalyticsEvent> {
        val raw = prefs.getString(KEY_EVENTS, null) ?: return emptyList()
        val array = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(
                    AnalyticsEvent(
                        name = item.optString("name"),
                        detail = item.optString("detail"),
                        timestamp = item.optLong("timestamp")
                    )
                )
            }
        }
    }

    fun clear() {
        prefs.edit().remove(KEY_EVENTS).apply()
    }

    private companion object {
        const val KEY_EVENTS = "events"
    }
}
