package com.example.pay.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pay.domain.Transaction
import com.example.pay.ui.components.EmptyState
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.ui.components.SectionCard
import com.example.pay.util.formatBackendDateTime
import com.example.pay.util.formatCurrency
import com.example.pay.util.transactionSourceLabel
import com.example.pay.util.transactionStatusLabel
import com.example.pay.util.transactionTypeLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionDetailScreen(
    transaction: Transaction?,
    categories: List<String>,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
    onDelete: (Transaction) -> Unit,
    onUpdateCategory: (String, Int, String) -> Unit,
    modifier: Modifier = Modifier
) {
    var editingCategory by remember { mutableStateOf(false) }
    var categoryValue by remember(transaction?.category) { mutableStateOf(transaction?.category.orEmpty()) }
    var categoryExpanded by remember { mutableStateOf(false) }

    if (transaction == null) {
        EmptyState("ไม่พบรายการ", "อาจยังไม่ sync หรือรายการนี้ถูกลบไปแล้ว")
        return
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { FinanceTopBar(title = "รายละเอียดรายการ", subtitle = transactionSourceLabel(transaction.source)) }
        item {
            SectionCard(title = transaction.category) {
                Text(formatCurrency(transaction.amount), style = MaterialTheme.typography.headlineMedium)
                Text("${transaction.displayDate} ${transaction.time}")
                Text("ประเภท: ${transactionTypeLabel(transaction.type)}")
                Text("สถานะ: ${transactionStatusLabel(transaction.status)}")
            }
        }
        item {
            SectionCard(title = "คู่รายการ") {
                Text("ผู้ส่ง: ${transaction.senderName.ifBlank { "-" }}")
                Text("ธนาคารผู้ส่ง: ${transaction.senderBank.ifBlank { "-" }}")
                Text("ผู้รับ: ${transaction.receiverName.ifBlank { "-" }}")
                Text("ธนาคารผู้รับ: ${transaction.receiverBank.ifBlank { "-" }}")
            }
        }
        item {
            SectionCard(title = "อ้างอิง") {
                Text("รหัสอ้างอิง: ${transaction.refId.ifBlank { "-" }}")
                Text("รหัสประมวลผล: ${transaction.executionId.ifBlank { "-" }}")
                Text("ตำแหน่งแถว: ${transaction.rowIndex}")
                Text("Transaction ID: ${transaction.transactionId}")
            }
        }
        item {
            SectionCard(title = "ข้อมูลเพิ่มเติม") {
                Text("สร้างเมื่อ: ${formatBackendDateTime(transaction.createdAt)}")
                Text("แก้ไขล่าสุด: ${formatBackendDateTime(transaction.updatedAt)}")
                Text("หมายเหตุ: ${transaction.note.ifBlank { "-" }}")
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = onBack) { Text("กลับ") }
                TextButton(onClick = { editingCategory = true }) { Text("เปลี่ยนหมวด") }
                TextButton(onClick = { onEdit(transaction.transactionId) }) { Text("แก้ไข") }
                TextButton(onClick = { onDelete(transaction) }) { Text("ลบ", color = MaterialTheme.colorScheme.error) }
            }
        }
    }

    if (editingCategory) {
        AlertDialog(
            onDismissRequest = { editingCategory = false },
            confirmButton = {
                TextButton(onClick = {
                    onUpdateCategory(transaction.transactionId, transaction.rowIndex, categoryValue)
                    editingCategory = false
                }) { Text("บันทึก") }
            },
            dismissButton = { TextButton(onClick = { editingCategory = false }) { Text("ยกเลิก") } },
            title = { Text("เปลี่ยนหมวดหมู่") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ExposedDropdownMenuBox(
                        expanded = categoryExpanded,
                        onExpandedChange = { categoryExpanded = !categoryExpanded }
                    ) {
                        OutlinedTextField(
                            value = categoryValue,
                            onValueChange = { categoryValue = it },
                            label = { Text("หมวดหมู่") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth()
                        )
                        DropdownMenu(
                            expanded = categoryExpanded,
                            onDismissRequest = { categoryExpanded = false }
                        ) {
                            categories.take(20).forEach { category ->
                                DropdownMenuItem(
                                    text = { Text(category) },
                                    onClick = {
                                        categoryValue = category
                                        categoryExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        )
    }
}
