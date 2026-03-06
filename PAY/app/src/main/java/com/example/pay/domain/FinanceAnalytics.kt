package com.example.pay.domain

import com.example.pay.util.currentMonth
import com.example.pay.util.currentYear
import com.example.pay.util.formatAmountCompact
import com.example.pay.util.parseDateTime
import com.example.pay.util.parseIsoDate
import java.time.LocalDate
import java.time.YearMonth
import kotlin.math.abs

object FinanceAnalytics {
    fun buildDashboard(
        transactions: List<Transaction>,
        selectedMonth: Int = currentMonth(),
        selectedYear: Int = currentYear(),
        isLoading: Boolean = false,
        isStale: Boolean = false,
        errorMessage: String? = null
    ): DashboardState {
        val selectedYm = YearMonth.of(selectedYear, selectedMonth)
        val currentMonthItems = transactions.filter { YearMonth.from(parseIsoDate(it.dateIso) ?: LocalDate.MIN) == selectedYm }
        val previousYm = selectedYm.minusMonths(1)
        val previousMonthItems = transactions.filter { YearMonth.from(parseIsoDate(it.dateIso) ?: LocalDate.MIN) == previousYm }

        val income = currentMonthItems.filter { it.type == "income" }.sumOf { it.amount }
        val expense = currentMonthItems.filter { it.type == "expense" }.sumOf { it.amount }
        val balance = income - expense

        val previousIncome = previousMonthItems.filter { it.type == "income" }.sumOf { it.amount }
        val previousExpense = previousMonthItems.filter { it.type == "expense" }.sumOf { it.amount }

        val categoryExpenses = currentMonthItems
            .filter { it.type == "expense" }
            .groupBy { it.category.ifBlank { "อื่นๆ" } }
            .map { CategoryAmount(it.key, it.value.sumOf(Transaction::amount)) }
            .sortedByDescending(CategoryAmount::amount)

        val recent = currentMonthItems
            .sortedByDescending { parseDateTime(it.dateIso, it.time) }
            .take(5)

        val trends = listOf(
            MetricTrend("รายรับเทียบเดือนก่อน", income, previousIncome),
            MetricTrend("รายจ่ายเทียบเดือนก่อน", expense, previousExpense),
            MetricTrend("คงเหลือเทียบเดือนก่อน", balance, previousIncome - previousExpense)
        )

        return DashboardState(
            balance = balance,
            income = income,
            expense = expense,
            selectedMonth = selectedMonth,
            selectedYear = selectedYear,
            categoryExpenses = categoryExpenses,
            recentTransactions = recent,
            trends = trends,
            insights = buildInsights(transactions, currentMonthItems),
            isLoading = isLoading,
            isStale = isStale,
            errorMessage = errorMessage
        )
    }

    fun buildStatistics(
        transactions: List<Transaction>,
        year: Int,
        isLoading: Boolean = false,
        errorMessage: String? = null
    ): StatisticsState {
        val yearItems = transactions.filter { parseIsoDate(it.dateIso)?.year == year }
        val monthLabels = listOf("ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.")
        val monthly = (1..12).map { month ->
            val monthItems = yearItems.filter { parseIsoDate(it.dateIso)?.monthValue == month }
            MonthlyBreakdown(
                monthLabel = monthLabels[month - 1],
                income = monthItems.filter { it.type == "income" }.sumOf { it.amount },
                expense = monthItems.filter { it.type == "expense" }.sumOf { it.amount }
            )
        }
        val yearlyIncome = monthly.sumOf { it.income }
        val yearlyExpense = monthly.sumOf { it.expense }
        val topCategories = yearItems.filter { it.type == "expense" }
            .groupBy { it.category.ifBlank { "อื่นๆ" } }
            .map { CategoryAmount(it.key, it.value.sumOf(Transaction::amount)) }
            .sortedByDescending(CategoryAmount::amount)
            .take(5)

        return StatisticsState(
            year = year,
            monthlyData = monthly,
            yearlyIncome = yearlyIncome,
            yearlyExpense = yearlyExpense,
            yearlyBalance = yearlyIncome - yearlyExpense,
            topCategories = topCategories,
            isLoading = isLoading,
            errorMessage = errorMessage
        )
    }

    fun sortTransactions(items: List<Transaction>, sort: TransactionSort): List<Transaction> = when (sort) {
        TransactionSort.NEWEST -> items.sortedByDescending { parseDateTime(it.dateIso, it.time) }
        TransactionSort.OLDEST -> items.sortedBy { parseDateTime(it.dateIso, it.time) }
        TransactionSort.HIGHEST -> items.sortedByDescending { abs(it.amount) }
        TransactionSort.LOWEST -> items.sortedBy { abs(it.amount) }
    }

    fun normalizeDraft(transaction: Transaction?): TransactionDraft {
        if (transaction == null) {
            val today = LocalDate.now()
            return TransactionDraft(
                dateIso = today.toString(),
                time = "12:00",
                category = "อื่นๆ"
            )
        }
        return TransactionDraft(
            transactionId = transaction.transactionId,
            rowIndex = transaction.rowIndex,
            dateIso = transaction.dateIso,
            time = transaction.time.ifBlank { "12:00" },
            type = transaction.type,
            amount = if (transaction.amount == 0.0) "" else transaction.amount.toString(),
            category = transaction.category,
            senderName = transaction.senderName,
            senderBank = transaction.senderBank,
            receiverName = transaction.receiverName,
            receiverBank = transaction.receiverBank,
            refId = transaction.refId,
            executionId = transaction.executionId,
            status = transaction.status.ifBlank { "active" },
            note = transaction.note
        )
    }

    private fun buildInsights(allTransactions: List<Transaction>, monthItems: List<Transaction>): List<InsightCard> {
        val today = LocalDate.now()
        val last7Days = allTransactions.filter {
            val date = parseIsoDate(it.dateIso) ?: return@filter false
            !date.isBefore(today.minusDays(6))
        }
        val last30Days = allTransactions.filter {
            val date = parseIsoDate(it.dateIso) ?: return@filter false
            !date.isBefore(today.minusDays(29))
        }
        val topMerchant = monthItems
            .filter { it.type == "expense" }
            .groupBy { it.receiverName.ifBlank { it.senderName.ifBlank { it.category } } }
            .maxByOrNull { (_, values) -> values.sumOf(Transaction::amount) }
        val recurringBills = allTransactions
            .filter { it.type == "expense" && (it.category.contains("Bill", ignoreCase = true) || it.category.contains("Payment", ignoreCase = true)) }
            .groupBy { it.receiverName.ifBlank { it.category } }
            .count { (_, values) -> values.size >= 2 }
        val duplicateAlerts = allTransactions
            .groupBy { it.refId.ifBlank { it.executionId } }
            .count { (key, values) -> key.isNotBlank() && values.size > 1 }

        return listOf(
            InsightCard(
                title = "ร้านที่จ่ายมากสุด",
                value = topMerchant?.key ?: "ยังไม่มี",
                supporting = topMerchant?.value?.sumOf(Transaction::amount)?.let { "เดือนนี้ ${formatAmountCompact(it)} บาท" } ?: "ยังไม่มีข้อมูลรายจ่าย"
            ),
            InsightCard(
                title = "บิลที่เกิดซ้ำ",
                value = recurringBills.toString(),
                supporting = "รายการบิลที่เกิดซ้ำอย่างน้อย 2 ครั้ง"
            ),
            InsightCard(
                title = "วันที่มีรายจ่ายต่อเนื่อง",
                value = "${buildSpendStreak(allTransactions)} วัน",
                supporting = "จำนวนวันติดที่มีรายจ่ายต่อเนื่อง"
            ),
            InsightCard(
                title = "แนวโน้ม 7/30 วัน",
                value = "${formatAmountCompact(last7Days.filter { it.type == "expense" }.sumOf { it.amount })} / ${formatAmountCompact(last30Days.filter { it.type == "expense" }.sumOf { it.amount })}",
                supporting = "รายจ่าย 7 วันล่าสุด เทียบ 30 วันล่าสุด"
            ),
            InsightCard(
                title = "แจ้งเตือนรายการซ้ำ",
                value = duplicateAlerts.toString(),
                supporting = "ธุรกรรมที่มี ref หรือ execution ซ้ำ"
            )
        )
    }

    private fun buildSpendStreak(transactions: List<Transaction>): Int {
        if (transactions.isEmpty()) return 0
        val expenseDates = transactions.filter { it.type == "expense" }.mapNotNull { parseIsoDate(it.dateIso) }.toSet()
        var streak = 0
        var cursor = LocalDate.now()
        while (expenseDates.contains(cursor)) {
            streak += 1
            cursor = cursor.minusDays(1)
        }
        return streak
    }
}
