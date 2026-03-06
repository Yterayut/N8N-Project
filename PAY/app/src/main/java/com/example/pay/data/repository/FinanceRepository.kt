package com.example.pay.data.repository

import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.room.withTransaction
import com.example.pay.data.api.ActionRequest
import com.example.pay.data.api.GasApiService
import com.example.pay.data.api.TransactionPayload
import com.example.pay.data.local.CategoryEntity
import com.example.pay.data.local.FinanceDatabase
import com.example.pay.data.local.TransactionEntity
import com.example.pay.data.settings.AnalyticsStore
import com.example.pay.data.settings.AppPreferencesRepository
import com.example.pay.domain.AppPreferencesState
import com.example.pay.domain.FinanceAnalytics
import com.example.pay.domain.SaveResult
import com.example.pay.domain.Transaction
import com.example.pay.domain.TransactionDraft
import com.example.pay.domain.TransactionFilters
import com.example.pay.util.displayToIsoDate
import com.example.pay.util.isoToDisplayDate
import com.example.pay.util.throwableToThaiMessage
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

class FinanceRepository(
    private val api: GasApiService,
    private val database: FinanceDatabase,
    private val preferencesRepository: AppPreferencesRepository,
    private val analyticsStore: AnalyticsStore
) {
    private val dao = database.financeDao()

    fun observePreferences(): Flow<AppPreferencesState> = preferencesRepository.preferences

    fun observeAllTransactions(): Flow<List<Transaction>> =
        dao.observeAllTransactions().map { rows -> rows.map { it.toDomain() } }

    fun observeCategories(): Flow<List<String>> =
        dao.observeCategories().map { rows -> rows.map(CategoryEntity::name) }

    fun observeTransactionCount(): Flow<Int> = dao.observeTransactionCount()

    fun observeTransaction(transactionId: String): Flow<Transaction?> =
        dao.observeTransaction(transactionId).map { it?.toDomain() }

    suspend fun getTransaction(transactionId: String): Transaction? = dao.getTransaction(transactionId)?.toDomain()

    fun pagedTransactions(filters: TransactionFilters): Flow<PagingData<Transaction>> =
        Pager(PagingConfig(pageSize = 25, enablePlaceholders = false)) {
            TransactionPagingSource {
                val rows = dao.getFilteredTransactions(
                    type = filters.type,
                    category = filters.category,
                    search = filters.search.trim().takeIf { it.isNotBlank() },
                    startDate = filters.startDateIso,
                    endDate = filters.endDateIso
                )
                FinanceAnalytics.sortTransactions(rows.map { it.toDomain() }, filters.sort)
            }
        }.flow

    suspend fun syncRemote(forceCategories: Boolean = true): SaveResult {
        val settings = preferencesRepository.preferences.first()
        val endpoint = settings.endpointUrl.trim()
        if (endpoint.isBlank()) return SaveResult(false, "ยังไม่ได้ตั้งค่า Apps Script endpoint")

        return runCatching {
            val apiKey = settings.apiKey.ifBlank { null }
            val transactionsResponse = api.getTransactions(url = endpoint, apiKey = apiKey)
            if (!transactionsResponse.success) error(transactionsResponse.error ?: "โหลดรายการไม่สำเร็จ")

            database.withTransaction {
                dao.clearTransactions()
                dao.upsertTransactions(transactionsResponse.transactions.map { it.toEntity() })
            }

            if (forceCategories) {
                val categoriesResponse = api.getCategories(url = endpoint, apiKey = apiKey)
                if (categoriesResponse.success) {
                    database.withTransaction {
                        dao.clearCategories()
                        dao.upsertCategories(categoriesResponse.categories.filter { it.isNotBlank() }.map(::CategoryEntity))
                    }
                }
            }

            val userResponse = api.getUserInfo(url = endpoint, apiKey = apiKey)
            if (userResponse.success) {
                preferencesRepository.updateDisplayName(userResponse.displayName)
            }

            preferencesRepository.recordSyncSuccess("Sync สำเร็จ ${transactionsResponse.transactions.size} รายการ")
            analyticsStore.track("sync_success", "transactions=${transactionsResponse.transactions.size}")
            SaveResult(true, "Sync สำเร็จ")
        }.getOrElse { throwable ->
            val errorMessage = throwableToThaiMessage(throwable)
            preferencesRepository.recordApiError(errorMessage)
            analyticsStore.track("sync_failed", throwable.message ?: "unknown")
            SaveResult(false, errorMessage)
        }
    }

    suspend fun addTransaction(draft: TransactionDraft): SaveResult = mutateTransaction("addTransaction", draft)

    suspend fun updateTransaction(draft: TransactionDraft): SaveResult {
        val transactionId = draft.transactionId ?: return SaveResult(false, "ไม่พบ transactionId สำหรับแก้ไขรายการ")
        return mutateTransaction("updateTransaction", draft, transactionId)
    }

    suspend fun deleteTransaction(transaction: Transaction): SaveResult {
        val settings = preferencesRepository.preferences.first()
        val endpoint = settings.endpointUrl.trim()
        if (endpoint.isBlank()) return SaveResult(false, "ยังไม่ได้ตั้งค่า endpoint")

        return runCatching {
            val response = api.postAction(
                url = endpoint,
                body = ActionRequest(
                    action = "deleteTransaction",
                    apiKey = settings.apiKey.ifBlank { null },
                    transactionId = transaction.transactionId,
                    rowIndex = transaction.rowIndex
                )
            )
            if (!response.success) error(response.error ?: "ลบรายการไม่สำเร็จ")
            dao.deleteTransaction(transaction.transactionId)
            preferencesRepository.recordSyncSuccess("ลบรายการ ${transaction.transactionId} สำเร็จ")
            analyticsStore.track("delete_transaction", "transactionId=${transaction.transactionId}")
            SaveResult(true, response.data?.message ?: response.message ?: "ลบสำเร็จ")
        }.getOrElse { throwable ->
            val errorMessage = throwableToThaiMessage(throwable)
            preferencesRepository.recordApiError(errorMessage)
            analyticsStore.track("delete_failed", throwable.message ?: "unknown")
            SaveResult(false, errorMessage)
        }
    }

    suspend fun restoreTransaction(transaction: Transaction): SaveResult {
        analyticsStore.track("undo_delete", "sourceRow=${transaction.rowIndex}")
        return addTransaction(
            FinanceAnalytics.normalizeDraft(transaction).copy(transactionId = null, rowIndex = null)
        )
    }

    suspend fun addCategory(name: String): SaveResult {
        val settings = preferencesRepository.preferences.first()
        val endpoint = settings.endpointUrl.trim()
        if (endpoint.isBlank()) return SaveResult(false, "ยังไม่ได้ตั้งค่า endpoint")
        val category = name.trim()
        if (category.isBlank()) return SaveResult(false, "หมวดหมู่ยังว่างอยู่")

        return runCatching {
            val response = api.postAction(
                url = endpoint,
                body = ActionRequest(
                    action = "addCategory",
                    apiKey = settings.apiKey.ifBlank { null },
                    category = category
                )
            )
            if (!response.success) error(response.error ?: "เพิ่มหมวดหมู่ไม่สำเร็จ")
            syncRemote(forceCategories = true)
            analyticsStore.track("add_category", category)
            SaveResult(true, response.data?.message ?: response.message ?: "เพิ่มหมวดหมู่สำเร็จ")
        }.getOrElse { throwable ->
            val errorMessage = throwableToThaiMessage(throwable)
            preferencesRepository.recordApiError(errorMessage)
            analyticsStore.track("add_category_failed", throwable.message ?: "unknown")
            SaveResult(false, errorMessage)
        }
    }

    suspend fun updateCategory(transactionId: String, rowIndex: Int, category: String): SaveResult {
        val settings = preferencesRepository.preferences.first()
        val endpoint = settings.endpointUrl.trim()
        if (endpoint.isBlank()) return SaveResult(false, "ยังไม่ได้ตั้งค่า endpoint")

        return runCatching {
            val response = api.postAction(
                url = endpoint,
                body = ActionRequest(
                    action = "updateCategory",
                    apiKey = settings.apiKey.ifBlank { null },
                    transactionId = transactionId,
                    rowIndex = rowIndex,
                    category = category.trim()
                )
            )
            if (!response.success) error(response.error ?: "อัปเดตหมวดหมู่ไม่สำเร็จ")
            syncRemote(forceCategories = false)
            analyticsStore.track("update_category", "transactionId=$transactionId category=${category.trim()}")
            SaveResult(true, response.data?.message ?: response.message ?: "อัปเดตหมวดหมู่สำเร็จ")
        }.getOrElse { throwable ->
            val errorMessage = throwableToThaiMessage(throwable)
            preferencesRepository.recordApiError(errorMessage)
            analyticsStore.track("update_category_failed", throwable.message ?: "unknown")
            SaveResult(false, errorMessage)
        }
    }

    suspend fun saveEndpoint(value: String) = preferencesRepository.updateEndpointUrl(value)

    suspend fun saveApiKey(value: String) = preferencesRepository.updateApiKey(value)

    suspend fun markScreen(screen: String) {
        preferencesRepository.recordViewedScreen(screen)
        analyticsStore.track("screen_view", screen)
    }

    private suspend fun mutateTransaction(action: String, draft: TransactionDraft, transactionId: String? = null): SaveResult {
        val settings = preferencesRepository.preferences.first()
        val endpoint = settings.endpointUrl.trim()
        if (endpoint.isBlank()) return SaveResult(false, "ยังไม่ได้ตั้งค่า endpoint")
        val amount = draft.amount.toDoubleOrNull() ?: return SaveResult(false, "จำนวนเงินไม่ถูกต้อง")

        return runCatching {
            val response = api.postAction(
                url = endpoint,
                body = ActionRequest(
                    action = action,
                    apiKey = settings.apiKey.ifBlank { null },
                    transactionId = transactionId ?: draft.transactionId,
                    rowIndex = draft.rowIndex,
                    data = draft.toPayload(amount)
                )
            )
            if (!response.success) error(response.error ?: "บันทึกไม่สำเร็จ")
            syncRemote(forceCategories = true)
            analyticsStore.track(action, draft.category)
            SaveResult(true, response.data?.message ?: response.message ?: "บันทึกสำเร็จ")
        }.getOrElse { throwable ->
            val errorMessage = throwableToThaiMessage(throwable)
            preferencesRepository.recordApiError(errorMessage)
            analyticsStore.track("${action}_failed", throwable.message ?: "unknown")
            SaveResult(false, errorMessage)
        }
    }

    private fun TransactionEntity.toDomain(): Transaction = Transaction(
        transactionId = transactionId,
        rowIndex = rowIndex,
        dateIso = dateIso,
        displayDate = displayDate,
        time = time,
        type = type,
        amount = amount,
        category = category,
        senderName = senderName,
        senderBank = senderBank,
        receiverName = receiverName,
        receiverBank = receiverBank,
        refId = refId,
        executionId = executionId,
        status = status,
        source = source,
        createdAt = createdAt,
        updatedAt = updatedAt,
        note = note
    )

    private fun com.example.pay.data.api.TransactionDto.toEntity(): TransactionEntity {
        val dateIso = if (date.contains("/")) displayToIsoDate(date) else date
        return TransactionEntity(
            transactionId = transactionId.ifBlank { "row-$rowIndex-${refId.ifBlank { executionId.ifBlank { dateIso } }}" },
            rowIndex = rowIndex,
            dateIso = dateIso,
            displayDate = if (date.contains("/")) date else isoToDisplayDate(dateIso),
            time = time,
            type = type.ifBlank { "expense" },
            amount = amount,
            category = category.ifBlank { "อื่นๆ" },
            senderName = senderName,
            senderBank = senderBank,
            receiverName = receiverName,
            receiverBank = receiverBank,
            refId = refId,
            executionId = executionId,
            status = status.ifBlank { "active" },
            source = source.ifBlank { if (refId.isNotBlank() || executionId.isNotBlank()) "slip" else "manual" },
            createdAt = createdAt,
            updatedAt = updatedAt,
            note = note
        )
    }

    private fun TransactionDraft.toPayload(amount: Double): TransactionPayload = TransactionPayload(
        transactionId = transactionId,
        rowIndex = rowIndex,
        date = dateIso,
        time = time,
        type = type,
        amount = amount,
        category = category,
        senderName = senderName,
        senderBank = senderBank,
        receiverName = receiverName,
        receiverBank = receiverBank,
        refId = refId,
        executionId = executionId,
        status = status,
        note = note
    )
}
