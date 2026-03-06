package com.example.pay.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pay.domain.DashboardState
import com.example.pay.ui.components.EmptyState
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.ui.components.HeroCard
import com.example.pay.ui.components.MetricStrip
import com.example.pay.ui.components.SectionCard
import com.example.pay.ui.components.TransactionRow
import com.example.pay.ui.components.TrendRow
import com.example.pay.ui.theme.Emerald500
import com.example.pay.ui.theme.Rose500
import com.example.pay.util.formatCurrency

@Composable
fun DashboardScreen(
    state: DashboardState,
    onRefresh: () -> Unit,
    onMonthChange: (Int) -> Unit,
    onYearChange: (Int) -> Unit,
    onOpenTransaction: (String) -> Unit,
    onVisible: () -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(Unit) { onVisible() }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            FinanceTopBar(title = "PAY", subtitle = "ภาพรวมการเงิน", onRefresh = onRefresh)
        }
        item {
            HeroCard(
                title = "ยอดคงเหลือ",
                amount = state.balance,
                supporting = if (state.isStale) "กำลังใช้ cached data ล่าสุด" else "สรุปจากข้อมูลที่ sync ล่าสุด"
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                MetricStrip("รายรับ", state.income, Emerald500, Modifier.weight(1f))
                MetricStrip("รายจ่าย", state.expense, Rose500, Modifier.weight(1f))
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = state.selectedMonth.toString(),
                    onValueChange = { value -> value.toIntOrNull()?.takeIf { it in 1..12 }?.let(onMonthChange) },
                    label = { Text("เดือน") },
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = state.selectedYear.toString(),
                    onValueChange = { value -> value.toIntOrNull()?.let(onYearChange) },
                    label = { Text("ปี") },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        item {
            SectionCard(title = "เทรนด์เทียบเดือนก่อน") {
                state.trends.forEach { trend ->
                    TrendRow(label = trend.label, current = trend.current, previous = trend.previous)
                }
            }
        }
        item {
            SectionCard(title = "อินไซต์สำคัญ") {
                state.insights.forEach { insight ->
                    Column {
                        Text(insight.title, style = MaterialTheme.typography.titleMedium)
                        Text(insight.value, style = MaterialTheme.typography.headlineMedium)
                        Text(insight.supporting, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                }
            }
        }
        item {
            if (state.categoryExpenses.isEmpty()) {
                EmptyState("ยังไม่มีรายจ่ายเดือนนี้", "เมื่อ sync หรือเพิ่มรายการแล้ว จะเห็นหมวดใช้จ่ายตรงนี้")
            } else {
                SectionCard(title = "หมวดใช้จ่ายสูงสุด") {
                    state.categoryExpenses.take(5).forEach { category ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(category.label)
                            Text(formatCurrency(category.amount))
                        }
                    }
                }
            }
        }
        item {
            Text("รายการล่าสุด", style = MaterialTheme.typography.titleLarge)
        }
        if (state.recentTransactions.isEmpty()) {
            item { EmptyState("ยังไม่มีรายการ", "ลอง sync ข้อมูลหรือเพิ่มรายการใหม่") }
        } else {
            items(state.recentTransactions) { transaction ->
                TransactionRow(item = transaction, onClick = { onOpenTransaction(transaction.transactionId) })
            }
        }
        item {
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
