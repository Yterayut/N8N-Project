package com.example.pay.data.repository

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.example.pay.domain.Transaction

class TransactionPagingSource(
    private val query: suspend () -> List<Transaction>
) : PagingSource<Int, Transaction>() {
    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Transaction> = try {
        val page = params.key ?: 0
        val pageSize = params.loadSize
        val items = query()
        val fromIndex = page * pageSize
        val toIndex = minOf(fromIndex + pageSize, items.size)
        val data = if (fromIndex >= items.size) emptyList() else items.subList(fromIndex, toIndex)
        LoadResult.Page(
            data = data,
            prevKey = if (page == 0) null else page - 1,
            nextKey = if (toIndex >= items.size) null else page + 1
        )
    } catch (throwable: Throwable) {
        LoadResult.Error(throwable)
    }

    override fun getRefreshKey(state: PagingState<Int, Transaction>): Int? =
        state.anchorPosition?.let { anchor ->
            state.closestPageToPosition(anchor)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchor)?.nextKey?.minus(1)
        }
}
