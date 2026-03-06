package com.example.pay.ui.transactions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.cachedIn
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.domain.SaveResult
import com.example.pay.domain.Transaction
import com.example.pay.domain.TransactionFilters
import com.example.pay.domain.TransactionSort
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
class TransactionsViewModel(
    private val repository: FinanceRepository
) : ViewModel() {
    val filters = MutableStateFlow(TransactionFilters())
    private val message = MutableStateFlow("")
    private val syncing = MutableStateFlow(false)
    private val undoCandidate = MutableStateFlow<Transaction?>(null)

    val categories = repository.observeCategories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val preferences = repository.observePreferences()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), com.example.pay.domain.AppPreferencesState())

    val pagedTransactions = filters
        .debounce(250)
        .flatMapLatest { repository.pagedTransactions(it) }
        .cachedIn(viewModelScope)

    val lastMessage = message
    val isSyncing = syncing
    val deletedTransaction = undoCandidate

    fun onVisible() {
        viewModelScope.launch { repository.markScreen("transactions") }
    }

    fun updateSearch(value: String) {
        filters.value = filters.value.copy(search = value)
    }

    fun updateType(value: String?) {
        filters.value = filters.value.copy(type = value)
    }

    fun updateCategoryFilter(value: String?) {
        filters.value = filters.value.copy(category = value)
    }

    fun updateStartDate(value: String?) {
        filters.value = filters.value.copy(startDateIso = value)
    }

    fun updateEndDate(value: String?) {
        filters.value = filters.value.copy(endDateIso = value)
    }

    fun updateSort(sort: TransactionSort) {
        filters.value = filters.value.copy(sort = sort)
    }

    fun clearFilters() {
        filters.value = TransactionFilters(sort = filters.value.sort)
    }

    fun refresh() {
        viewModelScope.launch {
            syncing.value = true
            val result = repository.syncRemote()
            message.value = result.message
            syncing.value = false
        }
    }

    fun delete(transaction: Transaction) {
        viewModelScope.launch {
            val result = repository.deleteTransaction(transaction)
            message.value = result.message
            if (result.success) {
                undoCandidate.value = transaction
            }
        }
    }

    fun undoDelete() {
        val transaction = undoCandidate.value ?: return
        runMutation {
            repository.restoreTransaction(transaction)
        }
        undoCandidate.value = null
    }

    fun consumeUndoCandidate() {
        undoCandidate.value = null
    }

    fun updateTransactionCategory(transactionId: String, rowIndex: Int, category: String) {
        runMutation { repository.updateCategory(transactionId, rowIndex, category) }
    }

    private fun runMutation(block: suspend () -> SaveResult) {
        viewModelScope.launch {
            val result = block()
            message.value = result.message
        }
    }
}
