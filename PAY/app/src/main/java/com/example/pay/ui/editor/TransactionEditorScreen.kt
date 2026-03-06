package com.example.pay.ui.editor

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.example.pay.domain.TransactionDraft
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.util.parseIsoDate
import com.example.pay.util.transactionStatusLabel
import com.example.pay.util.transactionTypeLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionEditorScreen(
    draft: TransactionDraft,
    categories: List<String>,
    isSaving: Boolean,
    onVisible: () -> Unit,
    onDraftChange: ((TransactionDraft) -> TransactionDraft) -> Unit,
    onSave: () -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(Unit) { onVisible() }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { FinanceTopBar(title = if (draft.transactionId == null) "เพิ่มรายการ" else "แก้ไขรายการ") }
        item {
            DateField(
                label = "วันที่",
                value = draft.dateIso,
                onChange = { value -> onDraftChange { it.copy(dateIso = value) } }
            )
        }
        item {
            TimeField(
                label = "เวลา",
                value = draft.time,
                onChange = { value -> onDraftChange { it.copy(time = value) } }
            )
        }
        item {
            DropdownField(
                label = "ประเภท",
                value = draft.type,
                options = listOf("income", "expense", "transfer"),
                labelForOption = ::transactionTypeLabel,
                onSelected = { value -> onDraftChange { it.copy(type = value) } }
            )
        }
        item {
            EditorField("จำนวนเงิน", draft.amount, supporting = "ตัวอย่าง 1250.50") { value ->
                onDraftChange { it.copy(amount = value.filter { c -> c.isDigit() || c == '.' }) }
            }
        }
        item {
            DropdownField(
                label = "หมวดหมู่",
                value = draft.category,
                options = (categories + draft.category).filter { it.isNotBlank() }.distinct().sorted(),
                allowCustom = true,
                onSelected = { value -> onDraftChange { it.copy(category = value) } }
            )
        }
        item { EditorField("ชื่อผู้ส่ง", draft.senderName) { value -> onDraftChange { it.copy(senderName = value) } } }
        item { EditorField("ธนาคารผู้ส่ง", draft.senderBank) { value -> onDraftChange { it.copy(senderBank = value) } } }
        item { EditorField("ชื่อผู้รับ", draft.receiverName) { value -> onDraftChange { it.copy(receiverName = value) } } }
        item { EditorField("ธนาคารผู้รับ", draft.receiverBank) { value -> onDraftChange { it.copy(receiverBank = value) } } }
        item { EditorField("รหัสอ้างอิง", draft.refId) { value -> onDraftChange { it.copy(refId = value) } } }
        item { EditorField("รหัสประมวลผล", draft.executionId) { value -> onDraftChange { it.copy(executionId = value) } } }
        item { EditorField("หมายเหตุ", draft.note) { value -> onDraftChange { it.copy(note = value) } } }
        item {
            DropdownField(
                label = "สถานะ",
                value = draft.status,
                options = listOf("active", "pending", "archived"),
                allowCustom = true,
                labelForOption = ::transactionStatusLabel,
                onSelected = { value -> onDraftChange { it.copy(status = value) } }
            )
        }
        item {
            Text(
                "ใช้ dropdown และ picker เพื่อลดความผิดพลาดจากการกรอกข้อมูล",
                style = MaterialTheme.typography.bodySmall
            )
        }
        item {
            FilledTonalButton(onClick = onSave, modifier = Modifier.fillMaxWidth(), enabled = !isSaving) {
                Text(if (isSaving) "กำลังบันทึก..." else "บันทึกรายการ")
            }
        }
    }
}

@Composable
private fun EditorField(label: String, value: String, supporting: String? = null, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        supportingText = supporting?.let { { Text(it) } },
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun DateField(label: String, value: String, onChange: (String) -> Unit) {
    val context = LocalContext.current
    val initialDate = parseIsoDate(value)
    val year = initialDate?.year ?: 2026
    val month = (initialDate?.monthValue ?: 1) - 1
    val day = initialDate?.dayOfMonth ?: 1

    OutlinedTextField(
        value = value,
        onValueChange = {},
        readOnly = true,
        label = { Text(label) },
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                DatePickerDialog(context, { _, pickedYear, pickedMonth, pickedDay ->
                    onChange("%04d-%02d-%02d".format(pickedYear, pickedMonth + 1, pickedDay))
                }, year, month, day).show()
            }
    )
}

@Composable
private fun TimeField(label: String, value: String, onChange: (String) -> Unit) {
    val context = LocalContext.current
    val split = value.split(":")
    val hour = split.getOrNull(0)?.toIntOrNull() ?: 12
    val minute = split.getOrNull(1)?.toIntOrNull() ?: 0

    OutlinedTextField(
        value = value,
        onValueChange = {},
        readOnly = true,
        label = { Text(label) },
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                TimePickerDialog(context, { _, pickedHour, pickedMinute ->
                    onChange("%02d:%02d".format(pickedHour, pickedMinute))
                }, hour, minute, true).show()
            }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    value: String,
    options: List<String>,
    allowCustom: Boolean = false,
    labelForOption: (String) -> String = { it },
    onSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var customValue by remember(value) { mutableStateOf(value) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = if (allowCustom) customValue else labelForOption(value),
            onValueChange = {
                customValue = it
                if (allowCustom) onSelected(it)
            },
            readOnly = !allowCustom,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.take(30).forEach { option ->
                DropdownMenuItem(
                    text = { Text(labelForOption(option)) },
                    onClick = {
                        customValue = option
                        onSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
