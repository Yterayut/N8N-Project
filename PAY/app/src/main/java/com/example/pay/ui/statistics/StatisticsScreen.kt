package com.example.pay.ui.statistics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pay.domain.StatisticsState
import com.example.pay.ui.components.EmptyState
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.ui.components.SectionCard
import com.example.pay.ui.theme.Emerald500
import com.example.pay.ui.theme.Rose500
import com.example.pay.util.formatCurrency

@Composable
fun StatisticsScreen(
    state: StatisticsState,
    onYearChange: (Int) -> Unit,
    onRefresh: () -> Unit,
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
            FinanceTopBar(title = "สถิติ", subtitle = "ภาพรวมทั้งปี", onRefresh = onRefresh)
        }
        item {
            OutlinedTextField(
                value = state.year.toString(),
                onValueChange = { value -> value.toIntOrNull()?.let(onYearChange) },
                label = { Text("ปี") },
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            SectionCard(title = "สรุปทั้งปี") {
                Text("รายรับรวม ${formatCurrency(state.yearlyIncome)}", color = Emerald500)
                Text("รายจ่ายรวม ${formatCurrency(state.yearlyExpense)}", color = Rose500)
                Text("คงเหลือ ${formatCurrency(state.yearlyBalance)}")
            }
        }
        item {
            if (state.monthlyData.isEmpty()) {
                EmptyState("ยังไม่มีข้อมูล", "เมื่อมี transaction ที่ sync แล้ว จะเห็นแนวโน้มรายเดือนตรงนี้")
            } else {
                SectionCard(title = "รายเดือน") {
                    state.monthlyData.forEach { month ->
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(month.monthLabel)
                                Text("${formatCurrency(month.income)} / ${formatCurrency(month.expense)}")
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height((month.income / 500.0).coerceAtLeast(8.0).toFloat().dp)
                                        .background(Emerald500, RoundedCornerShape(12.dp))
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height((month.expense / 500.0).coerceAtLeast(8.0).toFloat().dp)
                                        .background(Rose500, RoundedCornerShape(12.dp))
                                )
                            }
                        }
                    }
                }
            }
        }
        item {
            SectionCard(title = "หมวดใช้จ่ายสูงสุด") {
                if (state.topCategories.isEmpty()) {
                    Text("ยังไม่มีหมวดหมู่ที่นับได้")
                } else {
                    state.topCategories.forEachIndexed { index, category ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${index + 1}. ${category.label}")
                            Text(formatCurrency(category.amount))
                        }
                    }
                }
            }
        }
    }
}
