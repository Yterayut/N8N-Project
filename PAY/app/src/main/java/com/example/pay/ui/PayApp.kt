package com.example.pay.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.automirrored.filled.ViewList
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.SnackbarResult
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.foundation.layout.padding
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.pay.core.AppContainer
import com.example.pay.ui.dashboard.DashboardScreen
import com.example.pay.ui.dashboard.DashboardViewModel
import com.example.pay.ui.detail.TransactionDetailScreen
import com.example.pay.ui.editor.TransactionEditorScreen
import com.example.pay.ui.editor.TransactionEditorViewModel
import com.example.pay.ui.navigation.AppDestination
import com.example.pay.ui.settings.SettingsScreen
import com.example.pay.ui.settings.SettingsViewModel
import com.example.pay.ui.statistics.StatisticsScreen
import com.example.pay.ui.statistics.StatisticsViewModel
import com.example.pay.ui.transactions.TransactionsScreen
import com.example.pay.ui.transactions.TransactionsViewModel
import androidx.paging.compose.collectAsLazyPagingItems

@Composable
fun PayApp(container: AppContainer) {
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    val dashboardViewModel: DashboardViewModel = viewModel(factory = SimpleFactory { DashboardViewModel(container.repository) })
    val transactionsViewModel: TransactionsViewModel = viewModel(factory = SimpleFactory { TransactionsViewModel(container.repository) })
    val statisticsViewModel: StatisticsViewModel = viewModel(factory = SimpleFactory { StatisticsViewModel(container.repository) })
    val settingsViewModel: SettingsViewModel = viewModel(factory = SimpleFactory { SettingsViewModel(container.repository, container.analyticsStore, container.crashLogStore) })

    val dashboardState by dashboardViewModel.uiState.collectAsState()
    val filters by transactionsViewModel.filters.collectAsState()
    val categories by transactionsViewModel.categories.collectAsState()
    val lastMessage by transactionsViewModel.lastMessage.collectAsState()
    val deletedTransaction by transactionsViewModel.deletedTransaction.collectAsState()
    val pagedTransactions = transactionsViewModel.pagedTransactions.collectAsLazyPagingItems()
    val statisticsState by statisticsViewModel.uiState.collectAsState()
    val preferences by settingsViewModel.preferences.collectAsState()
    val settingsCategories by settingsViewModel.categories.collectAsState()
    val transactionCount by settingsViewModel.transactionCount.collectAsState()
    val crashInfo by settingsViewModel.crashInfo.collectAsState()
    val analyticsEvents by settingsViewModel.analyticsEvents.collectAsState()
    val inPreview = LocalInspectionMode.current

    LaunchedEffect(lastMessage) {
        if (lastMessage.isNotBlank()) snackbarHostState.showSnackbar(lastMessage)
    }

    LaunchedEffect(deletedTransaction?.transactionId) {
        val transaction = deletedTransaction ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "ลบ ${transaction.category} แล้ว",
            actionLabel = "เลิกทำ"
        )
        if (result == SnackbarResult.ActionPerformed) {
            transactionsViewModel.undoDelete()
        } else {
            transactionsViewModel.consumeUndoCandidate()
        }
    }

    LaunchedEffect(preferences.endpointUrl, transactionCount, inPreview) {
        if (!inPreview && preferences.endpointUrl.isNotBlank() && transactionCount == 0) {
            dashboardViewModel.refresh()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (currentRoute in setOf(
                    AppDestination.Dashboard.route,
                    AppDestination.Transactions.route,
                    AppDestination.Statistics.route,
                    AppDestination.Settings.route
                )
            ) {
                NavigationBar {
                    val items = listOf(
                        Triple(AppDestination.Dashboard.route, "หน้าหลัก", Icons.Default.Home),
                        Triple(AppDestination.Transactions.route, "รายการ", Icons.AutoMirrored.Filled.ViewList),
                        Triple(AppDestination.Statistics.route, "สถิติ", Icons.Default.BarChart),
                        Triple(AppDestination.Settings.route, "ตั้งค่า", Icons.Default.Settings)
                    )
                    items.forEach { (route, label, icon) ->
                        NavigationBarItem(
                            selected = currentRoute == route,
                            onClick = { navController.navigate(route) },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            modifier = Modifier.padding(innerPadding),
            navController = navController,
            startDestination = AppDestination.Dashboard.route
        ) {
            composable(AppDestination.Dashboard.route) {
                DashboardScreen(
                    state = dashboardState,
                    onRefresh = dashboardViewModel::refresh,
                    onMonthChange = dashboardViewModel::setMonth,
                    onYearChange = dashboardViewModel::setYear,
                    onOpenTransaction = { navController.navigate(AppDestination.Detail.createRoute(it)) },
                    onVisible = dashboardViewModel::onVisible
                )
            }
            composable(AppDestination.Transactions.route) {
                TransactionsScreen(
                    filters = filters,
                    pagedTransactions = pagedTransactions,
                    categories = categories,
                    lastMessage = lastMessage,
                    onVisible = transactionsViewModel::onVisible,
                    onRefresh = transactionsViewModel::refresh,
                    onSearchChange = transactionsViewModel::updateSearch,
                    onTypeChange = transactionsViewModel::updateType,
                    onCategoryChange = transactionsViewModel::updateCategoryFilter,
                    onStartDateChange = transactionsViewModel::updateStartDate,
                    onEndDateChange = transactionsViewModel::updateEndDate,
                    onSortChange = transactionsViewModel::updateSort,
                    onClearFilters = transactionsViewModel::clearFilters,
                    onDelete = transactionsViewModel::delete,
                    onOpenDetail = { navController.navigate(AppDestination.Detail.createRoute(it)) },
                    onAdd = { navController.navigate(AppDestination.Editor.createRoute(null)) }
                )
            }
            composable(AppDestination.Statistics.route) {
                StatisticsScreen(
                    state = statisticsState,
                    onYearChange = statisticsViewModel::setYear,
                    onRefresh = statisticsViewModel::refresh,
                    onVisible = statisticsViewModel::onVisible
                )
            }
            composable(AppDestination.Settings.route) {
                SettingsScreen(
                    preferences = preferences,
                    categories = settingsCategories,
                    transactionCount = transactionCount,
                    crashInfo = crashInfo,
                    analyticsEvents = analyticsEvents,
                    onVisible = settingsViewModel::onVisible,
                    onSaveEndpoint = settingsViewModel::saveEndpoint,
                    onSaveApiKey = settingsViewModel::saveApiKey,
                    onSync = settingsViewModel::sync,
                    onAddCategory = settingsViewModel::addCategory,
                    onClearCrash = settingsViewModel::clearCrashLog,
                    onClearAnalytics = settingsViewModel::clearAnalytics
                )
            }
            composable(
                route = AppDestination.Detail.route,
                arguments = listOf(navArgument("transactionId") { defaultValue = "" })
            ) { entry ->
                val transactionId = entry.arguments?.getString("transactionId").orEmpty()
                val transaction by container.repository.observeTransaction(transactionId).collectAsState(initial = null)
                TransactionDetailScreen(
                    transaction = transaction,
                    categories = categories,
                    onBack = { navController.popBackStack() },
                    onEdit = { navController.navigate(AppDestination.Editor.createRoute(it)) },
                    onDelete = {
                        transactionsViewModel.delete(it)
                        navController.popBackStack()
                    },
                    onUpdateCategory = transactionsViewModel::updateTransactionCategory
                )
            }
            composable(
                route = AppDestination.Editor.route,
                arguments = listOf(navArgument("transactionId") { defaultValue = "new" })
            ) { entry ->
                val transactionId = entry.arguments?.getString("transactionId")?.takeIf { it != "new" && !it.isNullOrBlank() }
                val editorViewModel: TransactionEditorViewModel = viewModel(
                    key = "editor:$transactionId",
                    factory = SimpleFactory { TransactionEditorViewModel(container.repository, transactionId) }
                )
                val draft by editorViewModel.draft.collectAsState()
                val editorCategories by editorViewModel.categories.collectAsState()
                val saving by editorViewModel.saving.collectAsState()
                val saveResult by editorViewModel.saveResult.collectAsState()

                LaunchedEffect(saveResult) {
                    if (saveResult?.success == true) {
                        navController.popBackStack()
                    } else if (saveResult != null) {
                        snackbarHostState.showSnackbar(saveResult?.message.orEmpty())
                    }
                }

                TransactionEditorScreen(
                    draft = draft,
                    categories = editorCategories,
                    isSaving = saving,
                    onVisible = editorViewModel::onVisible,
                    onDraftChange = editorViewModel::update,
                    onSave = editorViewModel::save
                )
            }
        }
    }
}
