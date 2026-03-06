package com.example.pay.data.local;

import android.database.Cursor;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.room.CoroutinesRoom;
import androidx.room.EntityInsertionAdapter;
import androidx.room.RoomDatabase;
import androidx.room.RoomSQLiteQuery;
import androidx.room.SharedSQLiteStatement;
import androidx.room.util.CursorUtil;
import androidx.room.util.DBUtil;
import androidx.sqlite.db.SupportSQLiteStatement;
import java.lang.Class;
import java.lang.Exception;
import java.lang.Integer;
import java.lang.Object;
import java.lang.Override;
import java.lang.String;
import java.lang.SuppressWarnings;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Callable;
import javax.annotation.processing.Generated;
import kotlin.Unit;
import kotlin.coroutines.Continuation;
import kotlinx.coroutines.flow.Flow;

@Generated("androidx.room.RoomProcessor")
@SuppressWarnings({"unchecked", "deprecation"})
public final class FinanceDao_Impl implements FinanceDao {
  private final RoomDatabase __db;

  private final EntityInsertionAdapter<TransactionEntity> __insertionAdapterOfTransactionEntity;

  private final EntityInsertionAdapter<CategoryEntity> __insertionAdapterOfCategoryEntity;

  private final SharedSQLiteStatement __preparedStmtOfClearTransactions;

  private final SharedSQLiteStatement __preparedStmtOfDeleteTransaction;

  private final SharedSQLiteStatement __preparedStmtOfClearCategories;

  public FinanceDao_Impl(@NonNull final RoomDatabase __db) {
    this.__db = __db;
    this.__insertionAdapterOfTransactionEntity = new EntityInsertionAdapter<TransactionEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `transactions` (`transactionId`,`rowIndex`,`dateIso`,`displayDate`,`time`,`type`,`amount`,`category`,`senderName`,`senderBank`,`receiverName`,`receiverBank`,`refId`,`executionId`,`status`,`source`,`createdAt`,`updatedAt`,`note`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final TransactionEntity entity) {
        statement.bindString(1, entity.getTransactionId());
        statement.bindLong(2, entity.getRowIndex());
        statement.bindString(3, entity.getDateIso());
        statement.bindString(4, entity.getDisplayDate());
        statement.bindString(5, entity.getTime());
        statement.bindString(6, entity.getType());
        statement.bindDouble(7, entity.getAmount());
        statement.bindString(8, entity.getCategory());
        statement.bindString(9, entity.getSenderName());
        statement.bindString(10, entity.getSenderBank());
        statement.bindString(11, entity.getReceiverName());
        statement.bindString(12, entity.getReceiverBank());
        statement.bindString(13, entity.getRefId());
        statement.bindString(14, entity.getExecutionId());
        statement.bindString(15, entity.getStatus());
        statement.bindString(16, entity.getSource());
        statement.bindString(17, entity.getCreatedAt());
        statement.bindString(18, entity.getUpdatedAt());
        statement.bindString(19, entity.getNote());
      }
    };
    this.__insertionAdapterOfCategoryEntity = new EntityInsertionAdapter<CategoryEntity>(__db) {
      @Override
      @NonNull
      protected String createQuery() {
        return "INSERT OR REPLACE INTO `categories` (`name`) VALUES (?)";
      }

      @Override
      protected void bind(@NonNull final SupportSQLiteStatement statement,
          @NonNull final CategoryEntity entity) {
        statement.bindString(1, entity.getName());
      }
    };
    this.__preparedStmtOfClearTransactions = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM transactions";
        return _query;
      }
    };
    this.__preparedStmtOfDeleteTransaction = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM transactions WHERE transactionId = ?";
        return _query;
      }
    };
    this.__preparedStmtOfClearCategories = new SharedSQLiteStatement(__db) {
      @Override
      @NonNull
      public String createQuery() {
        final String _query = "DELETE FROM categories";
        return _query;
      }
    };
  }

  @Override
  public Object upsertTransactions(final List<TransactionEntity> items,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfTransactionEntity.insert(items);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object upsertTransaction(final TransactionEntity item,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfTransactionEntity.insert(item);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object upsertCategories(final List<CategoryEntity> items,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        __db.beginTransaction();
        try {
          __insertionAdapterOfCategoryEntity.insert(items);
          __db.setTransactionSuccessful();
          return Unit.INSTANCE;
        } finally {
          __db.endTransaction();
        }
      }
    }, $completion);
  }

  @Override
  public Object clearTransactions(final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfClearTransactions.acquire();
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfClearTransactions.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object deleteTransaction(final String transactionId,
      final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfDeleteTransaction.acquire();
        int _argIndex = 1;
        _stmt.bindString(_argIndex, transactionId);
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfDeleteTransaction.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object clearCategories(final Continuation<? super Unit> $completion) {
    return CoroutinesRoom.execute(__db, true, new Callable<Unit>() {
      @Override
      @NonNull
      public Unit call() throws Exception {
        final SupportSQLiteStatement _stmt = __preparedStmtOfClearCategories.acquire();
        try {
          __db.beginTransaction();
          try {
            _stmt.executeUpdateDelete();
            __db.setTransactionSuccessful();
            return Unit.INSTANCE;
          } finally {
            __db.endTransaction();
          }
        } finally {
          __preparedStmtOfClearCategories.release(_stmt);
        }
      }
    }, $completion);
  }

  @Override
  public Object getFilteredTransactions(final String type, final String category,
      final String search, final String startDate, final String endDate,
      final Continuation<? super List<TransactionEntity>> $completion) {
    final String _sql = "\n"
            + "        SELECT * FROM transactions\n"
            + "        WHERE (? IS NULL OR type = ?)\n"
            + "        AND (? IS NULL OR category = ?)\n"
            + "        AND (? IS NULL OR dateIso >= ?)\n"
            + "        AND (? IS NULL OR dateIso <= ?)\n"
            + "        AND (\n"
            + "            ? IS NULL OR ? = '' OR\n"
            + "            category LIKE '%' || ? || '%' OR\n"
            + "            senderName LIKE '%' || ? || '%' OR\n"
            + "            senderBank LIKE '%' || ? || '%' OR\n"
            + "            receiverName LIKE '%' || ? || '%' OR\n"
            + "            receiverBank LIKE '%' || ? || '%' OR\n"
            + "            refId LIKE '%' || ? || '%' OR\n"
            + "            executionId LIKE '%' || ? || '%' OR\n"
            + "            note LIKE '%' || ? || '%'\n"
            + "        )\n"
            + "        ";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 18);
    int _argIndex = 1;
    if (type == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, type);
    }
    _argIndex = 2;
    if (type == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, type);
    }
    _argIndex = 3;
    if (category == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, category);
    }
    _argIndex = 4;
    if (category == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, category);
    }
    _argIndex = 5;
    if (startDate == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, startDate);
    }
    _argIndex = 6;
    if (startDate == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, startDate);
    }
    _argIndex = 7;
    if (endDate == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, endDate);
    }
    _argIndex = 8;
    if (endDate == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, endDate);
    }
    _argIndex = 9;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 10;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 11;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 12;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 13;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 14;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 15;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 16;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 17;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    _argIndex = 18;
    if (search == null) {
      _statement.bindNull(_argIndex);
    } else {
      _statement.bindString(_argIndex, search);
    }
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<TransactionEntity>>() {
      @Override
      @NonNull
      public List<TransactionEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionId = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionId");
          final int _cursorIndexOfRowIndex = CursorUtil.getColumnIndexOrThrow(_cursor, "rowIndex");
          final int _cursorIndexOfDateIso = CursorUtil.getColumnIndexOrThrow(_cursor, "dateIso");
          final int _cursorIndexOfDisplayDate = CursorUtil.getColumnIndexOrThrow(_cursor, "displayDate");
          final int _cursorIndexOfTime = CursorUtil.getColumnIndexOrThrow(_cursor, "time");
          final int _cursorIndexOfType = CursorUtil.getColumnIndexOrThrow(_cursor, "type");
          final int _cursorIndexOfAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "amount");
          final int _cursorIndexOfCategory = CursorUtil.getColumnIndexOrThrow(_cursor, "category");
          final int _cursorIndexOfSenderName = CursorUtil.getColumnIndexOrThrow(_cursor, "senderName");
          final int _cursorIndexOfSenderBank = CursorUtil.getColumnIndexOrThrow(_cursor, "senderBank");
          final int _cursorIndexOfReceiverName = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverName");
          final int _cursorIndexOfReceiverBank = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverBank");
          final int _cursorIndexOfRefId = CursorUtil.getColumnIndexOrThrow(_cursor, "refId");
          final int _cursorIndexOfExecutionId = CursorUtil.getColumnIndexOrThrow(_cursor, "executionId");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfSource = CursorUtil.getColumnIndexOrThrow(_cursor, "source");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final int _cursorIndexOfNote = CursorUtil.getColumnIndexOrThrow(_cursor, "note");
          final List<TransactionEntity> _result = new ArrayList<TransactionEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final TransactionEntity _item;
            final String _tmpTransactionId;
            _tmpTransactionId = _cursor.getString(_cursorIndexOfTransactionId);
            final int _tmpRowIndex;
            _tmpRowIndex = _cursor.getInt(_cursorIndexOfRowIndex);
            final String _tmpDateIso;
            _tmpDateIso = _cursor.getString(_cursorIndexOfDateIso);
            final String _tmpDisplayDate;
            _tmpDisplayDate = _cursor.getString(_cursorIndexOfDisplayDate);
            final String _tmpTime;
            _tmpTime = _cursor.getString(_cursorIndexOfTime);
            final String _tmpType;
            _tmpType = _cursor.getString(_cursorIndexOfType);
            final double _tmpAmount;
            _tmpAmount = _cursor.getDouble(_cursorIndexOfAmount);
            final String _tmpCategory;
            _tmpCategory = _cursor.getString(_cursorIndexOfCategory);
            final String _tmpSenderName;
            _tmpSenderName = _cursor.getString(_cursorIndexOfSenderName);
            final String _tmpSenderBank;
            _tmpSenderBank = _cursor.getString(_cursorIndexOfSenderBank);
            final String _tmpReceiverName;
            _tmpReceiverName = _cursor.getString(_cursorIndexOfReceiverName);
            final String _tmpReceiverBank;
            _tmpReceiverBank = _cursor.getString(_cursorIndexOfReceiverBank);
            final String _tmpRefId;
            _tmpRefId = _cursor.getString(_cursorIndexOfRefId);
            final String _tmpExecutionId;
            _tmpExecutionId = _cursor.getString(_cursorIndexOfExecutionId);
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final String _tmpSource;
            _tmpSource = _cursor.getString(_cursorIndexOfSource);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getString(_cursorIndexOfUpdatedAt);
            final String _tmpNote;
            _tmpNote = _cursor.getString(_cursorIndexOfNote);
            _item = new TransactionEntity(_tmpTransactionId,_tmpRowIndex,_tmpDateIso,_tmpDisplayDate,_tmpTime,_tmpType,_tmpAmount,_tmpCategory,_tmpSenderName,_tmpSenderBank,_tmpReceiverName,_tmpReceiverBank,_tmpRefId,_tmpExecutionId,_tmpStatus,_tmpSource,_tmpCreatedAt,_tmpUpdatedAt,_tmpNote);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Flow<List<TransactionEntity>> observeAllTransactions() {
    final String _sql = "SELECT * FROM transactions ORDER BY dateIso DESC, time DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"transactions"}, new Callable<List<TransactionEntity>>() {
      @Override
      @NonNull
      public List<TransactionEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionId = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionId");
          final int _cursorIndexOfRowIndex = CursorUtil.getColumnIndexOrThrow(_cursor, "rowIndex");
          final int _cursorIndexOfDateIso = CursorUtil.getColumnIndexOrThrow(_cursor, "dateIso");
          final int _cursorIndexOfDisplayDate = CursorUtil.getColumnIndexOrThrow(_cursor, "displayDate");
          final int _cursorIndexOfTime = CursorUtil.getColumnIndexOrThrow(_cursor, "time");
          final int _cursorIndexOfType = CursorUtil.getColumnIndexOrThrow(_cursor, "type");
          final int _cursorIndexOfAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "amount");
          final int _cursorIndexOfCategory = CursorUtil.getColumnIndexOrThrow(_cursor, "category");
          final int _cursorIndexOfSenderName = CursorUtil.getColumnIndexOrThrow(_cursor, "senderName");
          final int _cursorIndexOfSenderBank = CursorUtil.getColumnIndexOrThrow(_cursor, "senderBank");
          final int _cursorIndexOfReceiverName = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverName");
          final int _cursorIndexOfReceiverBank = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverBank");
          final int _cursorIndexOfRefId = CursorUtil.getColumnIndexOrThrow(_cursor, "refId");
          final int _cursorIndexOfExecutionId = CursorUtil.getColumnIndexOrThrow(_cursor, "executionId");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfSource = CursorUtil.getColumnIndexOrThrow(_cursor, "source");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final int _cursorIndexOfNote = CursorUtil.getColumnIndexOrThrow(_cursor, "note");
          final List<TransactionEntity> _result = new ArrayList<TransactionEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final TransactionEntity _item;
            final String _tmpTransactionId;
            _tmpTransactionId = _cursor.getString(_cursorIndexOfTransactionId);
            final int _tmpRowIndex;
            _tmpRowIndex = _cursor.getInt(_cursorIndexOfRowIndex);
            final String _tmpDateIso;
            _tmpDateIso = _cursor.getString(_cursorIndexOfDateIso);
            final String _tmpDisplayDate;
            _tmpDisplayDate = _cursor.getString(_cursorIndexOfDisplayDate);
            final String _tmpTime;
            _tmpTime = _cursor.getString(_cursorIndexOfTime);
            final String _tmpType;
            _tmpType = _cursor.getString(_cursorIndexOfType);
            final double _tmpAmount;
            _tmpAmount = _cursor.getDouble(_cursorIndexOfAmount);
            final String _tmpCategory;
            _tmpCategory = _cursor.getString(_cursorIndexOfCategory);
            final String _tmpSenderName;
            _tmpSenderName = _cursor.getString(_cursorIndexOfSenderName);
            final String _tmpSenderBank;
            _tmpSenderBank = _cursor.getString(_cursorIndexOfSenderBank);
            final String _tmpReceiverName;
            _tmpReceiverName = _cursor.getString(_cursorIndexOfReceiverName);
            final String _tmpReceiverBank;
            _tmpReceiverBank = _cursor.getString(_cursorIndexOfReceiverBank);
            final String _tmpRefId;
            _tmpRefId = _cursor.getString(_cursorIndexOfRefId);
            final String _tmpExecutionId;
            _tmpExecutionId = _cursor.getString(_cursorIndexOfExecutionId);
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final String _tmpSource;
            _tmpSource = _cursor.getString(_cursorIndexOfSource);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getString(_cursorIndexOfUpdatedAt);
            final String _tmpNote;
            _tmpNote = _cursor.getString(_cursorIndexOfNote);
            _item = new TransactionEntity(_tmpTransactionId,_tmpRowIndex,_tmpDateIso,_tmpDisplayDate,_tmpTime,_tmpType,_tmpAmount,_tmpCategory,_tmpSenderName,_tmpSenderBank,_tmpReceiverName,_tmpReceiverBank,_tmpRefId,_tmpExecutionId,_tmpStatus,_tmpSource,_tmpCreatedAt,_tmpUpdatedAt,_tmpNote);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getAllTransactions(
      final Continuation<? super List<TransactionEntity>> $completion) {
    final String _sql = "SELECT * FROM transactions ORDER BY dateIso DESC, time DESC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<List<TransactionEntity>>() {
      @Override
      @NonNull
      public List<TransactionEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionId = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionId");
          final int _cursorIndexOfRowIndex = CursorUtil.getColumnIndexOrThrow(_cursor, "rowIndex");
          final int _cursorIndexOfDateIso = CursorUtil.getColumnIndexOrThrow(_cursor, "dateIso");
          final int _cursorIndexOfDisplayDate = CursorUtil.getColumnIndexOrThrow(_cursor, "displayDate");
          final int _cursorIndexOfTime = CursorUtil.getColumnIndexOrThrow(_cursor, "time");
          final int _cursorIndexOfType = CursorUtil.getColumnIndexOrThrow(_cursor, "type");
          final int _cursorIndexOfAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "amount");
          final int _cursorIndexOfCategory = CursorUtil.getColumnIndexOrThrow(_cursor, "category");
          final int _cursorIndexOfSenderName = CursorUtil.getColumnIndexOrThrow(_cursor, "senderName");
          final int _cursorIndexOfSenderBank = CursorUtil.getColumnIndexOrThrow(_cursor, "senderBank");
          final int _cursorIndexOfReceiverName = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverName");
          final int _cursorIndexOfReceiverBank = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverBank");
          final int _cursorIndexOfRefId = CursorUtil.getColumnIndexOrThrow(_cursor, "refId");
          final int _cursorIndexOfExecutionId = CursorUtil.getColumnIndexOrThrow(_cursor, "executionId");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfSource = CursorUtil.getColumnIndexOrThrow(_cursor, "source");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final int _cursorIndexOfNote = CursorUtil.getColumnIndexOrThrow(_cursor, "note");
          final List<TransactionEntity> _result = new ArrayList<TransactionEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final TransactionEntity _item;
            final String _tmpTransactionId;
            _tmpTransactionId = _cursor.getString(_cursorIndexOfTransactionId);
            final int _tmpRowIndex;
            _tmpRowIndex = _cursor.getInt(_cursorIndexOfRowIndex);
            final String _tmpDateIso;
            _tmpDateIso = _cursor.getString(_cursorIndexOfDateIso);
            final String _tmpDisplayDate;
            _tmpDisplayDate = _cursor.getString(_cursorIndexOfDisplayDate);
            final String _tmpTime;
            _tmpTime = _cursor.getString(_cursorIndexOfTime);
            final String _tmpType;
            _tmpType = _cursor.getString(_cursorIndexOfType);
            final double _tmpAmount;
            _tmpAmount = _cursor.getDouble(_cursorIndexOfAmount);
            final String _tmpCategory;
            _tmpCategory = _cursor.getString(_cursorIndexOfCategory);
            final String _tmpSenderName;
            _tmpSenderName = _cursor.getString(_cursorIndexOfSenderName);
            final String _tmpSenderBank;
            _tmpSenderBank = _cursor.getString(_cursorIndexOfSenderBank);
            final String _tmpReceiverName;
            _tmpReceiverName = _cursor.getString(_cursorIndexOfReceiverName);
            final String _tmpReceiverBank;
            _tmpReceiverBank = _cursor.getString(_cursorIndexOfReceiverBank);
            final String _tmpRefId;
            _tmpRefId = _cursor.getString(_cursorIndexOfRefId);
            final String _tmpExecutionId;
            _tmpExecutionId = _cursor.getString(_cursorIndexOfExecutionId);
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final String _tmpSource;
            _tmpSource = _cursor.getString(_cursorIndexOfSource);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getString(_cursorIndexOfUpdatedAt);
            final String _tmpNote;
            _tmpNote = _cursor.getString(_cursorIndexOfNote);
            _item = new TransactionEntity(_tmpTransactionId,_tmpRowIndex,_tmpDateIso,_tmpDisplayDate,_tmpTime,_tmpType,_tmpAmount,_tmpCategory,_tmpSenderName,_tmpSenderBank,_tmpReceiverName,_tmpReceiverBank,_tmpRefId,_tmpExecutionId,_tmpStatus,_tmpSource,_tmpCreatedAt,_tmpUpdatedAt,_tmpNote);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Flow<TransactionEntity> observeTransaction(final String transactionId) {
    final String _sql = "SELECT * FROM transactions WHERE transactionId = ? LIMIT 1";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    _statement.bindString(_argIndex, transactionId);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"transactions"}, new Callable<TransactionEntity>() {
      @Override
      @Nullable
      public TransactionEntity call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionId = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionId");
          final int _cursorIndexOfRowIndex = CursorUtil.getColumnIndexOrThrow(_cursor, "rowIndex");
          final int _cursorIndexOfDateIso = CursorUtil.getColumnIndexOrThrow(_cursor, "dateIso");
          final int _cursorIndexOfDisplayDate = CursorUtil.getColumnIndexOrThrow(_cursor, "displayDate");
          final int _cursorIndexOfTime = CursorUtil.getColumnIndexOrThrow(_cursor, "time");
          final int _cursorIndexOfType = CursorUtil.getColumnIndexOrThrow(_cursor, "type");
          final int _cursorIndexOfAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "amount");
          final int _cursorIndexOfCategory = CursorUtil.getColumnIndexOrThrow(_cursor, "category");
          final int _cursorIndexOfSenderName = CursorUtil.getColumnIndexOrThrow(_cursor, "senderName");
          final int _cursorIndexOfSenderBank = CursorUtil.getColumnIndexOrThrow(_cursor, "senderBank");
          final int _cursorIndexOfReceiverName = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverName");
          final int _cursorIndexOfReceiverBank = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverBank");
          final int _cursorIndexOfRefId = CursorUtil.getColumnIndexOrThrow(_cursor, "refId");
          final int _cursorIndexOfExecutionId = CursorUtil.getColumnIndexOrThrow(_cursor, "executionId");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfSource = CursorUtil.getColumnIndexOrThrow(_cursor, "source");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final int _cursorIndexOfNote = CursorUtil.getColumnIndexOrThrow(_cursor, "note");
          final TransactionEntity _result;
          if (_cursor.moveToFirst()) {
            final String _tmpTransactionId;
            _tmpTransactionId = _cursor.getString(_cursorIndexOfTransactionId);
            final int _tmpRowIndex;
            _tmpRowIndex = _cursor.getInt(_cursorIndexOfRowIndex);
            final String _tmpDateIso;
            _tmpDateIso = _cursor.getString(_cursorIndexOfDateIso);
            final String _tmpDisplayDate;
            _tmpDisplayDate = _cursor.getString(_cursorIndexOfDisplayDate);
            final String _tmpTime;
            _tmpTime = _cursor.getString(_cursorIndexOfTime);
            final String _tmpType;
            _tmpType = _cursor.getString(_cursorIndexOfType);
            final double _tmpAmount;
            _tmpAmount = _cursor.getDouble(_cursorIndexOfAmount);
            final String _tmpCategory;
            _tmpCategory = _cursor.getString(_cursorIndexOfCategory);
            final String _tmpSenderName;
            _tmpSenderName = _cursor.getString(_cursorIndexOfSenderName);
            final String _tmpSenderBank;
            _tmpSenderBank = _cursor.getString(_cursorIndexOfSenderBank);
            final String _tmpReceiverName;
            _tmpReceiverName = _cursor.getString(_cursorIndexOfReceiverName);
            final String _tmpReceiverBank;
            _tmpReceiverBank = _cursor.getString(_cursorIndexOfReceiverBank);
            final String _tmpRefId;
            _tmpRefId = _cursor.getString(_cursorIndexOfRefId);
            final String _tmpExecutionId;
            _tmpExecutionId = _cursor.getString(_cursorIndexOfExecutionId);
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final String _tmpSource;
            _tmpSource = _cursor.getString(_cursorIndexOfSource);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getString(_cursorIndexOfUpdatedAt);
            final String _tmpNote;
            _tmpNote = _cursor.getString(_cursorIndexOfNote);
            _result = new TransactionEntity(_tmpTransactionId,_tmpRowIndex,_tmpDateIso,_tmpDisplayDate,_tmpTime,_tmpType,_tmpAmount,_tmpCategory,_tmpSenderName,_tmpSenderBank,_tmpReceiverName,_tmpReceiverBank,_tmpRefId,_tmpExecutionId,_tmpStatus,_tmpSource,_tmpCreatedAt,_tmpUpdatedAt,_tmpNote);
          } else {
            _result = null;
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Object getTransaction(final String transactionId,
      final Continuation<? super TransactionEntity> $completion) {
    final String _sql = "SELECT * FROM transactions WHERE transactionId = ? LIMIT 1";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 1);
    int _argIndex = 1;
    _statement.bindString(_argIndex, transactionId);
    final CancellationSignal _cancellationSignal = DBUtil.createCancellationSignal();
    return CoroutinesRoom.execute(__db, false, _cancellationSignal, new Callable<TransactionEntity>() {
      @Override
      @Nullable
      public TransactionEntity call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfTransactionId = CursorUtil.getColumnIndexOrThrow(_cursor, "transactionId");
          final int _cursorIndexOfRowIndex = CursorUtil.getColumnIndexOrThrow(_cursor, "rowIndex");
          final int _cursorIndexOfDateIso = CursorUtil.getColumnIndexOrThrow(_cursor, "dateIso");
          final int _cursorIndexOfDisplayDate = CursorUtil.getColumnIndexOrThrow(_cursor, "displayDate");
          final int _cursorIndexOfTime = CursorUtil.getColumnIndexOrThrow(_cursor, "time");
          final int _cursorIndexOfType = CursorUtil.getColumnIndexOrThrow(_cursor, "type");
          final int _cursorIndexOfAmount = CursorUtil.getColumnIndexOrThrow(_cursor, "amount");
          final int _cursorIndexOfCategory = CursorUtil.getColumnIndexOrThrow(_cursor, "category");
          final int _cursorIndexOfSenderName = CursorUtil.getColumnIndexOrThrow(_cursor, "senderName");
          final int _cursorIndexOfSenderBank = CursorUtil.getColumnIndexOrThrow(_cursor, "senderBank");
          final int _cursorIndexOfReceiverName = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverName");
          final int _cursorIndexOfReceiverBank = CursorUtil.getColumnIndexOrThrow(_cursor, "receiverBank");
          final int _cursorIndexOfRefId = CursorUtil.getColumnIndexOrThrow(_cursor, "refId");
          final int _cursorIndexOfExecutionId = CursorUtil.getColumnIndexOrThrow(_cursor, "executionId");
          final int _cursorIndexOfStatus = CursorUtil.getColumnIndexOrThrow(_cursor, "status");
          final int _cursorIndexOfSource = CursorUtil.getColumnIndexOrThrow(_cursor, "source");
          final int _cursorIndexOfCreatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "createdAt");
          final int _cursorIndexOfUpdatedAt = CursorUtil.getColumnIndexOrThrow(_cursor, "updatedAt");
          final int _cursorIndexOfNote = CursorUtil.getColumnIndexOrThrow(_cursor, "note");
          final TransactionEntity _result;
          if (_cursor.moveToFirst()) {
            final String _tmpTransactionId;
            _tmpTransactionId = _cursor.getString(_cursorIndexOfTransactionId);
            final int _tmpRowIndex;
            _tmpRowIndex = _cursor.getInt(_cursorIndexOfRowIndex);
            final String _tmpDateIso;
            _tmpDateIso = _cursor.getString(_cursorIndexOfDateIso);
            final String _tmpDisplayDate;
            _tmpDisplayDate = _cursor.getString(_cursorIndexOfDisplayDate);
            final String _tmpTime;
            _tmpTime = _cursor.getString(_cursorIndexOfTime);
            final String _tmpType;
            _tmpType = _cursor.getString(_cursorIndexOfType);
            final double _tmpAmount;
            _tmpAmount = _cursor.getDouble(_cursorIndexOfAmount);
            final String _tmpCategory;
            _tmpCategory = _cursor.getString(_cursorIndexOfCategory);
            final String _tmpSenderName;
            _tmpSenderName = _cursor.getString(_cursorIndexOfSenderName);
            final String _tmpSenderBank;
            _tmpSenderBank = _cursor.getString(_cursorIndexOfSenderBank);
            final String _tmpReceiverName;
            _tmpReceiverName = _cursor.getString(_cursorIndexOfReceiverName);
            final String _tmpReceiverBank;
            _tmpReceiverBank = _cursor.getString(_cursorIndexOfReceiverBank);
            final String _tmpRefId;
            _tmpRefId = _cursor.getString(_cursorIndexOfRefId);
            final String _tmpExecutionId;
            _tmpExecutionId = _cursor.getString(_cursorIndexOfExecutionId);
            final String _tmpStatus;
            _tmpStatus = _cursor.getString(_cursorIndexOfStatus);
            final String _tmpSource;
            _tmpSource = _cursor.getString(_cursorIndexOfSource);
            final String _tmpCreatedAt;
            _tmpCreatedAt = _cursor.getString(_cursorIndexOfCreatedAt);
            final String _tmpUpdatedAt;
            _tmpUpdatedAt = _cursor.getString(_cursorIndexOfUpdatedAt);
            final String _tmpNote;
            _tmpNote = _cursor.getString(_cursorIndexOfNote);
            _result = new TransactionEntity(_tmpTransactionId,_tmpRowIndex,_tmpDateIso,_tmpDisplayDate,_tmpTime,_tmpType,_tmpAmount,_tmpCategory,_tmpSenderName,_tmpSenderBank,_tmpReceiverName,_tmpReceiverBank,_tmpRefId,_tmpExecutionId,_tmpStatus,_tmpSource,_tmpCreatedAt,_tmpUpdatedAt,_tmpNote);
          } else {
            _result = null;
          }
          return _result;
        } finally {
          _cursor.close();
          _statement.release();
        }
      }
    }, $completion);
  }

  @Override
  public Flow<Integer> observeTransactionCount() {
    final String _sql = "SELECT COUNT(*) FROM transactions";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"transactions"}, new Callable<Integer>() {
      @Override
      @NonNull
      public Integer call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final Integer _result;
          if (_cursor.moveToFirst()) {
            final int _tmp;
            _tmp = _cursor.getInt(0);
            _result = _tmp;
          } else {
            _result = 0;
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @Override
  public Flow<List<CategoryEntity>> observeCategories() {
    final String _sql = "SELECT * FROM categories ORDER BY name ASC";
    final RoomSQLiteQuery _statement = RoomSQLiteQuery.acquire(_sql, 0);
    return CoroutinesRoom.createFlow(__db, false, new String[] {"categories"}, new Callable<List<CategoryEntity>>() {
      @Override
      @NonNull
      public List<CategoryEntity> call() throws Exception {
        final Cursor _cursor = DBUtil.query(__db, _statement, false, null);
        try {
          final int _cursorIndexOfName = CursorUtil.getColumnIndexOrThrow(_cursor, "name");
          final List<CategoryEntity> _result = new ArrayList<CategoryEntity>(_cursor.getCount());
          while (_cursor.moveToNext()) {
            final CategoryEntity _item;
            final String _tmpName;
            _tmpName = _cursor.getString(_cursorIndexOfName);
            _item = new CategoryEntity(_tmpName);
            _result.add(_item);
          }
          return _result;
        } finally {
          _cursor.close();
        }
      }

      @Override
      protected void finalize() {
        _statement.release();
      }
    });
  }

  @NonNull
  public static List<Class<?>> getRequiredConverters() {
    return Collections.emptyList();
  }
}
