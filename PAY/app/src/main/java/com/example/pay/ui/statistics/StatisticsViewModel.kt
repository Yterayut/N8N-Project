package com.example.pay.ui.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.domain.FinanceAnalytics
import com.example.pay.domain.StatisticsState
import com.example.pay.util.currentYear
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class StatisticsViewModel(
    private val repository: FinanceRepository
) : ViewModel() {
    private val selectedYear = MutableStateFlow(currentYear())
    private val refreshing = MutableStateFlow(false)
    private val transientError = MutableStateFlow<String?>(null)

    val uiState = combine(
        repository.observeAllTransactions(),
        selectedYear,
        refreshing,
        transientError
    ) { transactions, year, isRefreshing, error ->
        FinanceAnalytics.buildStatistics(
            transactions = transactions,
            year = year,
            isLoading = isRefreshing,
            errorMessage = error
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), StatisticsState())

    fun setYear(year: Int) {
        selectedYear.value = year
    }

    fun onVisible() {
        viewModelScope.launch { repository.markScreen("statistics") }
    }

    fun refresh() {
        viewModelScope.launch {
            refreshing.value = true
            val result = repository.syncRemote(forceCategories = false)
            transientError.value = result.message.takeIf { !result.success }
            refreshing.value = false
        }
    }
}
