package com.example.pay.data.api

import com.google.gson.annotations.SerializedName
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Url

interface GasApiService {
    @GET
    suspend fun getTransactions(
        @Url url: String,
        @Query("endpoint") endpoint: String = "transactions",
        @Query("search") search: String? = null,
        @Query("type") type: String? = null,
        @Query("category") category: String? = null,
        @Query("startDate") startDate: String? = null,
        @Query("endDate") endDate: String? = null,
        @Query("api_key") apiKey: String? = null
    ): TransactionsResponse

    @GET
    suspend fun getCategories(
        @Url url: String,
        @Query("endpoint") endpoint: String = "categories",
        @Query("api_key") apiKey: String? = null
    ): CategoriesResponse

    @GET
    suspend fun getUserInfo(
        @Url url: String,
        @Query("endpoint") endpoint: String = "userinfo",
        @Query("api_key") apiKey: String? = null
    ): UserInfoResponse

    @POST
    suspend fun postAction(
        @Url url: String,
        @Body body: ActionRequest
    ): ActionResponse

    companion object {
        fun create(): GasApiService {
            val logger = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            val client = OkHttpClient.Builder()
                .addInterceptor(logger)
                .build()

            return Retrofit.Builder()
                .baseUrl("https://script.google.com/")
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(GasApiService::class.java)
        }
    }
}

data class TransactionsResponse(
    val success: Boolean = false,
    val transactions: List<TransactionDto> = emptyList(),
    val error: String? = null
)

data class CategoriesResponse(
    val success: Boolean = false,
    val categories: List<String> = emptyList(),
    val error: String? = null
)

data class UserInfoResponse(
    val success: Boolean = false,
    val email: String = "",
    val displayName: String = "User",
    val error: String? = null
)

data class ActionRequest(
    val action: String,
    @SerializedName("api_key") val apiKey: String? = null,
    @SerializedName("transaction_id") val transactionId: String? = null,
    val rowIndex: Int? = null,
    val category: String? = null,
    @SerializedName("old_category") val oldCategory: String? = null,
    @SerializedName("new_category") val newCategory: String? = null,
    val data: TransactionPayload? = null
)

data class TransactionPayload(
    @SerializedName("transaction_id") val transactionId: String? = null,
    val rowIndex: Int? = null,
    val date: String,
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
    val note: String = ""
)

data class ActionResponseData(
    val rowIndex: Int? = null,
    @SerializedName("transaction_id") val transactionId: String? = null,
    val message: String? = null,
    val category: String? = null
)

data class ActionResponse(
    val success: Boolean = false,
    val status: String? = null,
    val message: String? = null,
    val error: String? = null,
    val duplicate: Boolean = false,
    val rowIndex: Int? = null,
    val data: ActionResponseData? = null
)

data class TransactionDto(
    @SerializedName("transaction_id") val transactionId: String = "",
    val rowIndex: Int = 0,
    val date: String = "",
    val time: String = "",
    val type: String = "",
    val amount: Double = 0.0,
    val category: String = "",
    val senderName: String = "",
    val senderBank: String = "",
    val receiverName: String = "",
    val receiverBank: String = "",
    val refId: String = "",
    val executionId: String = "",
    val status: String = "",
    val source: String = "",
    val createdAt: String = "",
    val updatedAt: String = "",
    val note: String = ""
)
