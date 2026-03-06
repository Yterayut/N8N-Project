package com.example.pay.data.settings

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.example.pay.domain.AppPreferencesState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "app_preferences")

class AppPreferencesRepository(context: Context) {
    private val dataStore = context.dataStore

    val preferences: Flow<AppPreferencesState> = dataStore.data.map { prefs ->
        AppPreferencesState(
            endpointUrl = prefs[Keys.EndpointUrl].orEmpty(),
            apiKey = prefs[Keys.ApiKey].orEmpty(),
            displayName = prefs[Keys.DisplayName] ?: "User",
            lastSyncAt = prefs[Keys.LastSyncAt] ?: 0L,
            lastSyncMessage = prefs[Keys.LastSyncMessage].orEmpty(),
            lastApiError = prefs[Keys.LastApiError].orEmpty(),
            lastViewedScreen = prefs[Keys.LastViewedScreen].orEmpty()
        )
    }

    suspend fun updateEndpointUrl(value: String) = setString(Keys.EndpointUrl, value.trim())

    suspend fun updateApiKey(value: String) = setString(Keys.ApiKey, value.trim())

    suspend fun updateDisplayName(value: String) = setString(Keys.DisplayName, value.trim())

    suspend fun recordSyncSuccess(message: String) {
        dataStore.edit { prefs ->
            prefs[Keys.LastSyncAt] = System.currentTimeMillis()
            prefs[Keys.LastSyncMessage] = message
            prefs[Keys.LastApiError] = ""
        }
    }

    suspend fun recordApiError(message: String) = setString(Keys.LastApiError, message)

    suspend fun recordViewedScreen(screen: String) = setString(Keys.LastViewedScreen, screen)

    private suspend fun setString(key: Preferences.Key<String>, value: String) {
        dataStore.edit { prefs -> prefs[key] = value }
    }

    private object Keys {
        val EndpointUrl = stringPreferencesKey("endpoint_url")
        val ApiKey = stringPreferencesKey("api_key")
        val DisplayName = stringPreferencesKey("display_name")
        val LastSyncAt = longPreferencesKey("last_sync_at")
        val LastSyncMessage = stringPreferencesKey("last_sync_message")
        val LastApiError = stringPreferencesKey("last_api_error")
        val LastViewedScreen = stringPreferencesKey("last_viewed_screen")
    }
}
