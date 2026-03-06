package com.example.pay.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.data.settings.AnalyticsEvent
import com.example.pay.data.settings.AnalyticsStore
import com.example.pay.data.settings.CrashLogStore
import com.example.pay.domain.CrashInfo
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val repository: FinanceRepository,
    private val analyticsStore: AnalyticsStore,
    private val crashLogStore: CrashLogStore
) : ViewModel() {
    val preferences = repository.observePreferences()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), com.example.pay.domain.AppPreferencesState())
    val categories = repository.observeCategories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val transactionCount = repository.observeTransactionCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    private val crashInfoState = MutableStateFlow(crashLogStore.read())
    val crashInfo = crashInfoState
    private val analyticsState = MutableStateFlow(analyticsStore.read())
    val analyticsEvents = analyticsState

    fun onVisible() {
        viewModelScope.launch { repository.markScreen("settings") }
    }

    fun saveEndpoint(value: String) {
        viewModelScope.launch { repository.saveEndpoint(value) }
    }

    fun saveApiKey(value: String) {
        viewModelScope.launch { repository.saveApiKey(value) }
    }

    fun sync() {
        viewModelScope.launch { repository.syncRemote() }
    }

    fun addCategory(name: String) {
        viewModelScope.launch { repository.addCategory(name) }
    }

    fun clearCrashLog() {
        crashLogStore.clear()
        crashInfoState.value = crashLogStore.read()
    }

    fun clearAnalytics() {
        analyticsStore.clear()
        analyticsState.value = analyticsStore.read()
    }
}
