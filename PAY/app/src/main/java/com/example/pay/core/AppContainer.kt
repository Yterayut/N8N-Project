package com.example.pay.core

import android.content.Context
import com.example.pay.data.api.GasApiService
import com.example.pay.data.local.FinanceDatabase
import com.example.pay.data.repository.FinanceRepository
import com.example.pay.data.settings.AnalyticsStore
import com.example.pay.data.settings.AppPreferencesRepository
import com.example.pay.data.settings.CrashLogStore

class AppContainer(context: Context) {
    private val appContext = context.applicationContext

    val preferencesRepository: AppPreferencesRepository by lazy {
        AppPreferencesRepository(appContext)
    }

    val crashLogStore: CrashLogStore by lazy {
        CrashLogStore(appContext)
    }

    val analyticsStore: AnalyticsStore by lazy {
        AnalyticsStore(appContext)
    }

    private val database: FinanceDatabase by lazy {
        FinanceDatabase.create(appContext)
    }

    private val apiService: GasApiService by lazy {
        GasApiService.create()
    }

    val repository: FinanceRepository by lazy {
        FinanceRepository(
            api = apiService,
            database = database,
            preferencesRepository = preferencesRepository,
            analyticsStore = analyticsStore
        )
    }
}
