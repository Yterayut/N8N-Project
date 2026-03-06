package com.example.pay.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pay.domain.AppPreferencesState
import com.example.pay.domain.CrashInfo
import com.example.pay.data.settings.AnalyticsEvent
import com.example.pay.ui.components.FinanceTopBar
import com.example.pay.ui.components.SectionCard
import com.example.pay.util.apiErrorToThai
import com.example.pay.util.formatTimestamp

@Composable
fun SettingsScreen(
    preferences: AppPreferencesState,
    categories: List<String>,
    transactionCount: Int,
    crashInfo: CrashInfo,
    analyticsEvents: List<AnalyticsEvent>,
    onVisible: () -> Unit,
    onSaveEndpoint: (String) -> Unit,
    onSaveApiKey: (String) -> Unit,
    onSync: () -> Unit,
    onAddCategory: (String) -> Unit,
    onClearCrash: () -> Unit,
    onClearAnalytics: () -> Unit,
    modifier: Modifier = Modifier
) {
    LaunchedEffect(Unit) { onVisible() }
    var endpoint by remember(preferences.endpointUrl) { mutableStateOf(preferences.endpointUrl) }
    var apiKey by remember(preferences.apiKey) { mutableStateOf(preferences.apiKey) }
    var newCategory by remember { mutableStateOf("") }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { FinanceTopBar(title = "ตั้งค่า", subtitle = preferences.displayName) }
        item {
            SectionCard(title = "การเชื่อมต่อ") {
                OutlinedTextField(value = endpoint, onValueChange = { endpoint = it }, label = { Text("Apps Script endpoint") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = apiKey, onValueChange = { apiKey = it }, label = { Text("API key") }, modifier = Modifier.fillMaxWidth())
                FilledTonalButton(onClick = {
                    onSaveEndpoint(endpoint)
                    onSaveApiKey(apiKey)
                }, modifier = Modifier.fillMaxWidth()) {
                    Text("บันทึกการเชื่อมต่อ")
                }
                FilledTonalButton(onClick = onSync, modifier = Modifier.fillMaxWidth()) {
                    Text("ซิงก์ตอนนี้")
                }
            }
        }
        item {
            SectionCard(title = "สถานะระบบ") {
                Text("ซิงก์ล่าสุด: ${formatTimestamp(preferences.lastSyncAt)}")
                Text("ผลการซิงก์: ${preferences.lastSyncMessage.ifBlank { "-" }}")
                Text("ข้อผิดพลาดล่าสุด: ${preferences.lastApiError.ifBlank { "-" }.let(::apiErrorToThai)}")
                Text("หน้าล่าสุด: ${preferences.lastViewedScreen.ifBlank { "-" }}")
                Text("รายการที่แคชไว้: $transactionCount")
            }
        }
        item {
            SectionCard(title = "หมวดหมู่") {
                OutlinedTextField(value = newCategory, onValueChange = { newCategory = it }, label = { Text("เพิ่มหมวดหมู่") }, modifier = Modifier.fillMaxWidth())
                FilledTonalButton(onClick = {
                    onAddCategory(newCategory)
                    newCategory = ""
                }, modifier = Modifier.fillMaxWidth()) {
                    Text("บันทึกหมวดหมู่")
                }
                Text(categories.joinToString())
            }
        }
        item {
            SectionCard(title = "บันทึกข้อผิดพลาด") {
                Text(if (crashInfo.message.isBlank()) "ยังไม่มี crash log" else crashInfo.message)
                Text("เวลาเกิดเหตุ: ${formatTimestamp(crashInfo.timestamp)}")
                FilledTonalButton(onClick = onClearCrash, modifier = Modifier.fillMaxWidth()) {
                    Text("ล้าง crash log")
                }
            }
        }
        item {
            SectionCard(title = "เหตุการณ์การใช้งาน") {
                if (analyticsEvents.isEmpty()) {
                    Text("ยังไม่มีเหตุการณ์การใช้งาน")
                } else {
                    analyticsEvents.take(10).forEach { event ->
                        Text("${event.name} • ${event.detail.ifBlank { "-" }} • ${formatTimestamp(event.timestamp)}")
                    }
                }
                FilledTonalButton(onClick = onClearAnalytics, modifier = Modifier.fillMaxWidth()) {
                    Text("ล้างประวัติการใช้งาน")
                }
            }
        }
    }
}
