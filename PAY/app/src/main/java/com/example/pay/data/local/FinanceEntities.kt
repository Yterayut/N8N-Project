package com.example.pay.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val transactionId: String,
    val rowIndex: Int,
    val dateIso: String,
    val displayDate: String,
    val time: String,
    val type: String,
    val amount: Double,
    val category: String,
    val senderName: String,
    val senderBank: String,
    val receiverName: String,
    val receiverBank: String,
    val refId: String,
    val executionId: String,
    val status: String,
    val source: String,
    val createdAt: String,
    val updatedAt: String,
    val note: String
)

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val name: String
)
