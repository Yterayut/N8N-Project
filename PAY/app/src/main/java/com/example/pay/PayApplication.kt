package com.example.pay

import android.app.Application
import com.example.pay.core.AppContainer

class PayApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            container.crashLogStore.record(throwable)
            previousHandler?.uncaughtException(thread, throwable)
        }
    }
}
