package com.example.pay.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

class SimpleFactory<T : ViewModel>(
    private val creator: () -> T
) : ViewModelProvider.Factory {
    override fun <R : ViewModel> create(modelClass: Class<R>): R = creator() as R
}
