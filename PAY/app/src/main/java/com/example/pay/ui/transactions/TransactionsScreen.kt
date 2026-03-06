package com.example.pay.ui.transactions

import android.app.DatePickerDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.itemKey
import com.example.pay.domain.Transaction
import com.example.pay.domain.TransactionFilters
import com.example.pay.domain.TransactionSort
import com.example.pay.ui.components.EmptyState
import com.example.pay.ui.components.FilterRow
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.ui.components.LoadingState
import com.example.pay.ui.components.TransactionRow
import com.example.pay.util.apiErrorToThai
import com.example.pay.util.parseIsoDate
import com.example.pay.util.transactionSortLabel
import com.example.pay.util.transactionTypeLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    filters: TransactionFilters,
    pagedTransactions: LazyPagingItems<Transaction>,
    categories: List<String>,
    lastMessage: String,
    onVisible: () -> Unit,
    onRefresh: () -> Unit,
    onSearchChange: (String) -> Unit,
    onTypeChange: (String?) -> Unit,
    onCategoryChange: (String?) -> Unit,
    onStartDateChange: (String?) -> Unit,
    onEndDateChange: (String?) -> Unit,
    onSortChange: (TransactionSort) -> Unit,
    onClearFilters: () -> Unit,
    onDelete: (Transaction) -> Unit,
    onOpenDetail: (String) -> Unit,
    onAdd: () -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(Unit) { onVisible() }
    var pendingDeleteId by remember { mutableStateOf<String?>(null) }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = { FinanceTopBar(title = "รายการทั้งหมด", subtitle = lastMessage.takeIf { it.isNotBlank() }, onRefresh = onRefresh) },
        floatingActionButton = {
            FloatingActionButton(onClick = onAdd) {
                Text("+")
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = filters.search,
                        onValueChange = onSearchChange,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("ค้นหา") }
                    )
                    FilterRow(
                        options = listOf("income", "expense", "transfer"),
                        selected = filters.type,
                        onSelected = onTypeChange,
                        labelFor = ::transactionTypeLabel
                    )
                    FilterRow(options = categories.take(12), selected = filters.category, onSelected = onCategoryChange)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                        FilterDateField(
                            label = "เริ่มวันที่",
                            value = filters.startDateIso.orEmpty(),
                            modifier = Modifier.weight(1f),
                            onChange = { onStartDateChange(it.ifBlank { null }) }
                        )
                        FilterDateField(
                            label = "ถึงวันที่",
                            value = filters.endDateIso.orEmpty(),
                            modifier = Modifier.weight(1f),
                            onChange = { onEndDateChange(it.ifBlank { null }) }
                        )
                    }
                    FilterRow(
                        options = TransactionSort.entries.map { it.name },
                        selected = filters.sort.name,
                        onSelected = { value -> value?.let { onSortChange(TransactionSort.valueOf(it)) } },
                        labelFor = ::transactionSortLabel
                    )
                    TextButton(onClick = onClearFilters, modifier = Modifier.fillMaxWidth()) { Text("ล้างตัวกรอง") }
                }
            }

            if (pagedTransactions.loadState.refresh is LoadState.Loading) {
                item { LoadingState("กำลังโหลดรายการ...") }
            } else if (pagedTransactions.loadState.refresh is LoadState.Error) {
                val error = (pagedTransactions.loadState.refresh as LoadState.Error).error
                item {
                    EmptyState("โหลดรายการไม่สำเร็จ", apiErrorToThai(error.message))
                }
            } else if (pagedTransactions.itemCount == 0) {
                item {
                    EmptyState("ไม่พบรายการ", "ลองปรับ filter หรือกด sync ใหม่")
                }
            } else {
                items(
                    count = pagedTransactions.itemCount,
                    key = pagedTransactions.itemKey { it.transactionId.ifBlank { it.rowIndex } }
                ) { index ->
                    val item = pagedTransactions[index] ?: return@items
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        TransactionRow(item = item, onClick = { onOpenDetail(item.transactionId) })
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                            TextButton(onClick = { onOpenDetail(item.transactionId) }) { Text("รายละเอียด") }
                            TextButton(onClick = { pendingDeleteId = item.transactionId }) { Text("ลบ", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
        }
    }

    if (pendingDeleteId != null) {
        AlertDialog(
            onDismissRequest = { pendingDeleteId = null },
            confirmButton = {
                TextButton(onClick = {
                    pagedTransactions.itemSnapshotList.items.firstOrNull { it.transactionId == pendingDeleteId }?.let(onDelete)
                    pendingDeleteId = null
                }) { Text("ลบ") }
            },
            dismissButton = { TextButton(onClick = { pendingDeleteId = null }) { Text("ยกเลิก") } },
            title = { Text("ลบรายการ") },
            text = { Text("ยืนยันการลบรายการนี้") }
        )
    }
}

@Composable
private fun FilterDateField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onChange: (String) -> Unit
) {
    val context = LocalContext.current
    val initialDate = parseIsoDate(value)
    val year = initialDate?.year ?: 2026
    val month = (initialDate?.monthValue ?: 1) - 1
    val day = initialDate?.dayOfMonth ?: 1

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            modifier = Modifier
                .weight(1f)
                .clickable {
                    DatePickerDialog(context, { _, pickedYear, pickedMonth, pickedDay ->
                        onChange("%04d-%02d-%02d".format(pickedYear, pickedMonth + 1, pickedDay))
                    }, year, month, day).show()
                }
        )
        TextButton(onClick = { onChange("") }) {
            Text("ล้าง")
        }
    }
}
