package com.example.pay.ui.editor

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.domain.FinanceAnalytics
import com.example.pay.domain.SaveResult
import com.example.pay.domain.TransactionDraft
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class TransactionEditorViewModel(
    private val repository: FinanceRepository,
    private val transactionId: String?
) : ViewModel() {
    private val initialised = MutableStateFlow(false)
    val draft = MutableStateFlow(FinanceAnalytics.normalizeDraft(null))
    val saving = MutableStateFlow(false)
    val saveResult = MutableStateFlow<SaveResult?>(null)

    val categories = repository.observeCategories()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (!transactionId.isNullOrBlank()) {
            viewModelScope.launch {
                repository.observeTransaction(transactionId).collect { transaction ->
                    if (!initialised.value) {
                        draft.value = FinanceAnalytics.normalizeDraft(transaction)
                        initialised.value = true
                    }
                }
            }
        } else {
            initialised.value = true
        }
    }

    fun onVisible() {
        viewModelScope.launch { repository.markScreen("editor") }
    }

    fun update(transform: (TransactionDraft) -> TransactionDraft) {
        draft.value = transform(draft.value)
    }

    fun save() {
        viewModelScope.launch {
            saving.value = true
            saveResult.value = if (draft.value.transactionId.isNullOrBlank()) {
                repository.addTransaction(draft.value)
            } else {
                repository.updateTransaction(draft.value)
            }
            saving.value = false
        }
    }
}
