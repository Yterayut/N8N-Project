package com.example.pay.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.domain.AppPreferencesState
import com.example.pay.domain.DashboardState
import com.example.pay.domain.FinanceAnalytics
import com.example.pay.domain.Transaction
import com.example.pay.util.currentMonth
import com.example.pay.util.currentYear
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DashboardViewModel(
    private val repository: FinanceRepository
) : ViewModel() {
    private val selectedMonth = MutableStateFlow(currentMonth())
    private val selectedYear = MutableStateFlow(currentYear())
    private val refreshing = MutableStateFlow(false)
    private val transientError = MutableStateFlow<String?>(null)

    val uiState = combine(
        repository.observeAllTransactions(),
        repository.observePreferences(),
        selectedMonth,
        selectedYear
    ) { transactions: List<Transaction>, preferences: AppPreferencesState, month: Int, year: Int ->
        DashboardSeed(transactions, preferences, month, year)
    }.combine(refreshing) { seed, isRefreshing ->
        seed to isRefreshing
    }.combine(transientError) { (seed, isRefreshing), error ->
        FinanceAnalytics.buildDashboard(
            transactions = seed.transactions,
            selectedMonth = seed.month,
            selectedYear = seed.year,
            isLoading = isRefreshing,
            isStale = seed.preferences.lastApiError.isNotBlank(),
            errorMessage = error ?: seed.preferences.lastApiError.takeIf { it.isNotBlank() }
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardState())

    fun setMonth(month: Int) {
        selectedMonth.value = month
    }

    fun setYear(year: Int) {
        selectedYear.value = year
    }

    fun onVisible() {
        viewModelScope.launch { repository.markScreen("dashboard") }
    }

    fun refresh() {
        viewModelScope.launch {
            refreshing.value = true
            transientError.value = null
            val result = repository.syncRemote()
            if (!result.success) transientError.value = result.message
            refreshing.value = false
        }
    }
}

private data class DashboardSeed(
    val transactions: List<Transaction>,
    val preferences: AppPreferencesState,
    val month: Int,
    val year: Int
)
