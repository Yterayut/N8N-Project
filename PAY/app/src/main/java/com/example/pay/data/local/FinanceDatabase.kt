package com.example.pay.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [TransactionEntity::class, CategoryEntity::class],
    version = 2,
    exportSchema = false
)
abstract class FinanceDatabase : RoomDatabase() {
    abstract fun financeDao(): FinanceDao

    companion object {
        fun create(context: Context): FinanceDatabase =
            Room.databaseBuilder(
                context,
                FinanceDatabase::class.java,
                "finance.db"
            ).fallbackToDestructiveMigration().build()
    }
}
