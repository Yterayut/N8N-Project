package com.example.pay.domain

data class Transaction(
    val transactionId: String,
    val rowIndex: Int,
    val dateIso: String,
    val displayDate: String,
    val time: String,
    val type: String,
    val amount: Double,
    val category: String,
    val senderName: String,
    val senderBank: String,
    val receiverName: String,
    val receiverBank: String,
    val refId: String,
    val executionId: String,
    val status: String,
    val source: String,
    val createdAt: String,
    val updatedAt: String,
    val note: String
)

data class TransactionFilters(
    val search: String = "",
    val type: String? = null,
    val category: String? = null,
    val startDateIso: String? = null,
    val endDateIso: String? = null,
    val sort: TransactionSort = TransactionSort.NEWEST
)

enum class TransactionSort {
    NEWEST,
    OLDEST,
    HIGHEST,
    LOWEST
}

data class TransactionDraft(
    val transactionId: String? = null,
    val rowIndex: Int? = null,
    val dateIso: String = "",
    val time: String = "",
    val type: String = "expense",
    val amount: String = "",
    val category: String = "",
    val senderName: String = "",
    val senderBank: String = "",
    val receiverName: String = "",
    val receiverBank: String = "",
    val refId: String = "",
    val executionId: String = "",
    val status: String = "active",
    val note: String = ""
)

data class MetricTrend(
    val label: String,
    val current: Double,
    val previous: Double
)

data class InsightCard(
    val title: String,
    val value: String,
    val supporting: String
)

data class DashboardState(
    val balance: Double = 0.0,
    val income: Double = 0.0,
    val expense: Double = 0.0,
    val selectedMonth: Int = 1,
    val selectedYear: Int = 2026,
    val categoryExpenses: List<CategoryAmount> = emptyList(),
    val recentTransactions: List<Transaction> = emptyList(),
    val trends: List<MetricTrend> = emptyList(),
    val insights: List<InsightCard> = emptyList(),
    val isStale: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

data class StatisticsState(
    val year: Int = 2026,
    val monthlyData: List<MonthlyBreakdown> = emptyList(),
    val yearlyIncome: Double = 0.0,
    val yearlyExpense: Double = 0.0,
    val yearlyBalance: Double = 0.0,
    val topCategories: List<CategoryAmount> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

data class MonthlyBreakdown(
    val monthLabel: String,
    val income: Double,
    val expense: Double
)

data class CategoryAmount(
    val label: String,
    val amount: Double
)

data class AppPreferencesState(
    val endpointUrl: String = "",
    val apiKey: String = "",
    val displayName: String = "User",
    val lastSyncAt: Long = 0L,
    val lastSyncMessage: String = "",
    val lastApiError: String = "",
    val lastViewedScreen: String = ""
)

data class CrashInfo(
    val message: String = "",
    val timestamp: Long = 0L
)

data class SaveResult(
    val success: Boolean,
    val message: String
)
