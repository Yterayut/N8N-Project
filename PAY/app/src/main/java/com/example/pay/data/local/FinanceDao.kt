package com.example.pay.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface FinanceDao {
    @Query(
        """
        SELECT * FROM transactions
        WHERE (:type IS NULL OR type = :type)
        AND (:category IS NULL OR category = :category)
        AND (:startDate IS NULL OR dateIso >= :startDate)
        AND (:endDate IS NULL OR dateIso <= :endDate)
        AND (
            :search IS NULL OR :search = '' OR
            category LIKE '%' || :search || '%' OR
            senderName LIKE '%' || :search || '%' OR
            senderBank LIKE '%' || :search || '%' OR
            receiverName LIKE '%' || :search || '%' OR
            receiverBank LIKE '%' || :search || '%' OR
            refId LIKE '%' || :search || '%' OR
            executionId LIKE '%' || :search || '%' OR
            note LIKE '%' || :search || '%'
        )
        """
    )
    suspend fun getFilteredTransactions(
        type: String?,
        category: String?,
        search: String?,
        startDate: String?,
        endDate: String?
    ): List<TransactionEntity>

    @Query("SELECT * FROM transactions ORDER BY dateIso DESC, time DESC")
    fun observeAllTransactions(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions ORDER BY dateIso DESC, time DESC")
    suspend fun getAllTransactions(): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE transactionId = :transactionId LIMIT 1")
    fun observeTransaction(transactionId: String): Flow<TransactionEntity?>

    @Query("SELECT * FROM transactions WHERE transactionId = :transactionId LIMIT 1")
    suspend fun getTransaction(transactionId: String): TransactionEntity?

    @Query("SELECT COUNT(*) FROM transactions")
    fun observeTransactionCount(): Flow<Int>

    @Query("DELETE FROM transactions")
    suspend fun clearTransactions()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTransactions(items: List<TransactionEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTransaction(item: TransactionEntity)

    @Query("DELETE FROM transactions WHERE transactionId = :transactionId")
    suspend fun deleteTransaction(transactionId: String)

    @Query("SELECT * FROM categories ORDER BY name ASC")
    fun observeCategories(): Flow<List<CategoryEntity>>

    @Query("DELETE FROM categories")
    suspend fun clearCategories()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertCategories(items: List<CategoryEntity>)
}
