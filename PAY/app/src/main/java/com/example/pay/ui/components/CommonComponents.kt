package com.example.pay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.pay.domain.Transaction
import com.example.pay.ui.theme.Emerald500
import com.example.pay.ui.theme.Gold500
import com.example.pay.ui.theme.Rose500
import com.example.pay.ui.theme.Sky500
import com.example.pay.util.formatAmountCompact
import com.example.pay.util.formatCurrency
import com.example.pay.util.transactionSourceLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FinanceTopBar(
    title: String,
    subtitle: String? = null,
    onRefresh: (() -> Unit)? = null
) {
    CenterAlignedTopAppBar(
        title = {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = title, style = MaterialTheme.typography.titleLarge)
                if (subtitle != null) {
                    Text(text = subtitle, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        actions = {
            if (onRefresh != null) {
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Default.Sync, contentDescription = "รีเฟรช")
                }
            }
        }
    )
}

@Composable
fun HeroCard(
    title: String,
    amount: Double,
    supporting: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Box(
            modifier = Modifier
                .background(Brush.linearGradient(listOf(MaterialTheme.colorScheme.primary, Gold500)))
                .padding(20.dp)
        ) {
            Column {
                Text(text = title, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f))
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = formatCurrency(amount),
                    color = MaterialTheme.colorScheme.onPrimary,
                    style = MaterialTheme.typography.headlineMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = supporting, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f))
            }
        }
    }
}

@Composable
fun MetricStrip(title: String, value: Double, accent: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(18.dp)) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = formatCurrency(value), color = accent, style = MaterialTheme.typography.titleLarge)
        }
    }
}

@Composable
fun SectionCard(title: String, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
fun EmptyState(title: String, supporting: String) {
    Card(shape = RoundedCornerShape(20.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = title, style = MaterialTheme.typography.titleMedium)
            Text(text = supporting, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
        }
    }
}

@Composable
fun LoadingState(label: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        CircularProgressIndicator()
        Text(text = label)
    }
}

@Composable
fun FilterRow(
    options: List<String>,
    selected: String?,
    onSelected: (String?) -> Unit,
    labelFor: (String) -> String = { it }
) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { option ->
            AssistChip(
                onClick = { onSelected(if (option == selected) null else option) },
                label = { Text(labelFor(option)) }
            )
        }
    }
}

@Composable
fun TransactionRow(
    item: Transaction,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val amountColor = when (item.type) {
        "income" -> Emerald500
        "expense" -> Rose500
        else -> Sky500
    }
    val sign = when (item.type) {
        "income" -> "+"
        "expense" -> "-"
        else -> ""
    }
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(text = item.category, style = MaterialTheme.typography.titleMedium)
                Text(
                    text = listOf(item.displayDate, item.time, transactionSourceLabel(item.source)).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                val counterparty = item.receiverName.ifBlank { item.senderName }
                if (counterparty.isNotBlank()) {
                    Text(
                        text = counterparty,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = "$sign${formatAmountCompact(item.amount)}",
                color = amountColor,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
fun TrendRow(label: String, current: Double, previous: Double) {
    val diff = current - previous
    val diffLabel = if (diff >= 0) "+${formatAmountCompact(diff)}" else formatAmountCompact(diff)
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(text = label, modifier = Modifier.weight(1f))
        Text(text = "${formatAmountCompact(current)} ($diffLabel)")
    }
}
