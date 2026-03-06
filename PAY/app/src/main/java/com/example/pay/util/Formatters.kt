package com.example.pay.util

import java.text.NumberFormat
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale
import java.net.SocketTimeoutException
import java.net.UnknownHostException

private val thaiLocale = Locale("th", "TH")
private val displayDateFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", thaiLocale)
private val isoDateFormatter = DateTimeFormatter.ISO_LOCAL_DATE
private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm", thaiLocale)
private val timestampFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", thaiLocale)
private val backendDateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

fun formatCurrency(amount: Double): String {
    val formatter = NumberFormat.getCurrencyInstance(thaiLocale)
    formatter.currency = java.util.Currency.getInstance("THB")
    formatter.maximumFractionDigits = 2
    return formatter.format(amount)
}

fun formatAmountCompact(amount: Double): String {
    val formatter = NumberFormat.getNumberInstance(thaiLocale)
    formatter.maximumFractionDigits = 2
    return formatter.format(amount)
}

fun isoToDisplayDate(isoDate: String): String = try {
    LocalDate.parse(isoDate, isoDateFormatter).format(displayDateFormatter)
} catch (_: DateTimeParseException) {
    isoDate
}

fun displayToIsoDate(displayDate: String): String = try {
    LocalDate.parse(displayDate, displayDateFormatter).format(isoDateFormatter)
} catch (_: DateTimeParseException) {
    displayDate
}

fun parseIsoDate(value: String): LocalDate? = try {
    LocalDate.parse(value, isoDateFormatter)
} catch (_: DateTimeParseException) {
    null
}

fun parseTime(value: String): LocalTime? = try {
    LocalTime.parse(value, timeFormatter)
} catch (_: DateTimeParseException) {
    null
}

fun parseDateTime(dateIso: String, time: String): LocalDateTime {
    val date = parseIsoDate(dateIso) ?: LocalDate.MIN
    val parsedTime = parseTime(time) ?: LocalTime.MIN
    return LocalDateTime.of(date, parsedTime)
}

fun formatTimestamp(timestamp: Long): String {
    if (timestamp <= 0L) return "-"
    return runCatching {
        LocalDateTime.ofEpochSecond(timestamp / 1000, 0, java.time.ZoneOffset.ofHours(7))
            .format(timestampFormatter)
    }.getOrDefault(timestamp.toString())
}

fun formatBackendDateTime(value: String): String {
    if (value.isBlank()) return "-"
    return runCatching {
        when {
            value.contains("T") -> LocalDateTime.parse(value.replace("Z", "")).format(timestampFormatter)
            value.contains(":") && value.contains("-") -> LocalDateTime.parse(value, backendDateTimeFormatter).format(timestampFormatter)
            else -> value
        }
    }.getOrDefault(value)
}

fun transactionTypeLabel(type: String): String = when (type.lowercase()) {
    "income" -> "รายรับ"
    "expense" -> "รายจ่าย"
    "transfer" -> "โอนเงิน"
    else -> type.ifBlank { "-" }
}

fun transactionStatusLabel(status: String): String = when (status.lowercase()) {
    "active" -> "ใช้งาน"
    "pending" -> "รอดำเนินการ"
    "archived" -> "เก็บถาวร"
    "success" -> "สำเร็จ"
    "duplicate" -> "ซ้ำ"
    else -> status.ifBlank { "-" }
}

fun transactionSourceLabel(source: String): String = when (source.lowercase()) {
    "slip" -> "สลิป"
    "manual" -> "กรอกเอง"
    "n8n" -> "อัตโนมัติ"
    "webapp" -> "เว็บแอป"
    "line" -> "LINE"
    else -> source.ifBlank { "-" }
}

fun transactionSortLabel(sort: String): String = when (sort.uppercase()) {
    "NEWEST" -> "ใหม่สุด"
    "OLDEST" -> "เก่าสุด"
    "HIGHEST" -> "ยอดสูงสุด"
    "LOWEST" -> "ยอดต่ำสุด"
    else -> sort
}

fun apiErrorToThai(message: String?): String {
    val raw = message?.trim().orEmpty()
    if (raw.isBlank()) return "เกิดข้อผิดพลาดในการเชื่อมต่อ"
    val normalized = raw.lowercase()
    return when {
        normalized.contains("unauthorized") -> "ไม่ได้รับอนุญาต กรุณาตรวจสอบ API key"
        normalized.contains("rest get api disabled") -> "บริการอ่านข้อมูลชั่วคราวไม่พร้อมใช้งาน"
        normalized.contains("timeout") -> "เชื่อมต่อช้าเกินกำหนด กรุณาลองใหม่"
        normalized.contains("unable to resolve host") || normalized.contains("unknownhost") -> "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตหรือเซิร์ฟเวอร์ได้"
        normalized.contains("failed to connect") -> "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"
        normalized.contains("connection reset") -> "การเชื่อมต่อถูกตัด กรุณาลองใหม่"
        normalized.contains("delete failed") -> "ลบรายการไม่สำเร็จ"
        normalized.contains("update category failed") -> "อัปเดตหมวดหมู่ไม่สำเร็จ"
        normalized.contains("mutation failed") -> "บันทึกรายการไม่สำเร็จ"
        normalized.contains("unknown api error") -> "เกิดข้อผิดพลาดจาก API"
        normalized.contains("failed to fetch dashboard") -> "โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"
        normalized.contains("failed to fetch") -> "โหลดข้อมูลไม่สำเร็จ"
        else -> raw
    }
}

fun throwableToThaiMessage(throwable: Throwable): String = when (throwable) {
    is UnknownHostException -> "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตหรือเซิร์ฟเวอร์ได้"
    is SocketTimeoutException -> "เชื่อมต่อช้าเกินกำหนด กรุณาลองใหม่"
    else -> apiErrorToThai(throwable.message)
}

fun yearMonthOf(dateIso: String): YearMonth? = parseIsoDate(dateIso)?.let { YearMonth.from(it) }

fun currentYear(): Int = LocalDate.now().year

fun currentMonth(): Int = LocalDate.now().monthValue
