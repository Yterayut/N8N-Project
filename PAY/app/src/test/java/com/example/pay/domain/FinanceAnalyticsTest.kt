package com.example.pay.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FinanceAnalyticsTest {
    @Test
    fun `buildDashboard calculates totals and insights`() {
        val transactions = listOf(
            sample(rowIndex = 2, dateIso = "2026-03-01", type = "income", amount = 5000.0, category = "Salary"),
            sample(rowIndex = 3, dateIso = "2026-03-02", type = "expense", amount = 200.0, category = "Food", receiverName = "Cafe"),
            sample(rowIndex = 4, dateIso = "2026-03-02", type = "expense", amount = 300.0, category = "Bill Payment", receiverName = "Internet")
        )

        val state = FinanceAnalytics.buildDashboard(
            transactions = transactions,
            selectedMonth = 3,
            selectedYear = 2026
        )

        assertEquals(5000.0, state.income, 0.0)
        assertEquals(500.0, state.expense, 0.0)
        assertEquals(4500.0, state.balance, 0.0)
        assertEquals(2, state.categoryExpenses.size)
        assertTrue(state.insights.isNotEmpty())
    }

    @Test
    fun `sortTransactions orders by amount descending for HIGHEST`() {
        val sorted = FinanceAnalytics.sortTransactions(
            listOf(
                sample(rowIndex = 2, amount = 120.0),
                sample(rowIndex = 3, amount = 920.0),
                sample(rowIndex = 4, amount = 50.0)
            ),
            TransactionSort.HIGHEST
        )

        assertEquals(3, sorted.first().rowIndex)
        assertEquals(4, sorted.last().rowIndex)
    }

    private fun sample(
        rowIndex: Int,
        dateIso: String = "2026-03-03",
        type: String = "expense",
        amount: Double = 100.0,
        category: String = "Food",
        receiverName: String = ""
    ) = Transaction(
        rowIndex = rowIndex,
        dateIso = dateIso,
        displayDate = "03/03/2026",
        time = "12:00",
        type = type,
        amount = amount,
        category = category,
        senderName = "",
        senderBank = "",
        receiverName = receiverName,
        receiverBank = "",
        refId = "",
        executionId = "",
        status = "active",
        source = "manual"
    )
}
