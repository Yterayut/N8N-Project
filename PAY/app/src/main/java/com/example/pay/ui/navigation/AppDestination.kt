package com.example.pay.ui.navigation

sealed class AppDestination(val route: String) {
    data object Dashboard : AppDestination("dashboard")
    data object Transactions : AppDestination("transactions")
    data object Statistics : AppDestination("statistics")
    data object Settings : AppDestination("settings")
    data object Detail : AppDestination("detail/{transactionId}") {
        fun createRoute(transactionId: String) = "detail/$transactionId"
    }
    data object Editor : AppDestination("editor/{transactionId}") {
        fun createRoute(transactionId: String?) = "editor/${transactionId ?: "new"}"
    }
}
