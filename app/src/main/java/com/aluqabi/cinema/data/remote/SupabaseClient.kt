package com.aluqabi.cinema.data.remote

import com.aluqabi.cinema.config.AppConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder

class SupabaseClient(private val http: OkHttpClient) {
    private val jsonType = "application/json".toMediaType()
    val json: Json = Json { ignoreUnknownKeys = true; isLenient = true; explicitNulls = false }

    fun isConfigured(): Boolean = AppConfig.isSupabaseConfigured

    private fun String.enc(): String = URLEncoder.encode(this, "UTF-8")

    private fun authHeaders(token: String?): Request.Builder.() -> Unit = {
        header("apikey", AppConfig.SUPABASE_ANON_KEY)
        header("Authorization", "Bearer ${token?.takeIf { it.isNotBlank() } ?: AppConfig.SUPABASE_ANON_KEY}")
        header("Content-Type", "application/json")
    }

    suspend fun authPost(path: String, body: JsonObject, token: String? = null): Result<JsonObject> =
        request("POST", "${AppConfig.SUPABASE_URL}$path", body.toString(), token)

    suspend fun authGet(path: String, token: String): Result<JsonObject> =
        request("GET", "${AppConfig.SUPABASE_URL}$path", null, token)

    suspend fun restGet(path: String, token: String? = null, prefer: String? = null): Result<JsonElement> =
        requestElement("GET", "${AppConfig.SUPABASE_URL}/rest/v1/$path", null, token, prefer)

    suspend fun restPost(path: String, body: JsonElement, token: String? = null, prefer: String = "return=representation"): Result<JsonElement> =
        requestElement("POST", "${AppConfig.SUPABASE_URL}/rest/v1/$path", body.toString(), token, prefer)

    suspend fun restPatch(path: String, body: JsonObject, token: String? = null, prefer: String = "return=representation"): Result<JsonElement> =
        requestElement("PATCH", "${AppConfig.SUPABASE_URL}/rest/v1/$path", body.toString(), token, prefer)

    suspend fun restDelete(path: String, token: String? = null): Result<JsonElement> =
        requestElement("DELETE", "${AppConfig.SUPABASE_URL}/rest/v1/$path", null, token, "return=minimal")

    suspend fun rpc(name: String, body: JsonObject = JsonObject(emptyMap()), token: String? = null): Result<JsonElement> =
        requestElement("POST", "${AppConfig.SUPABASE_URL}/rest/v1/rpc/$name", body.toString(), token)

    private suspend fun request(method: String, url: String, body: String?, token: String?): Result<JsonObject> =
        withContext(Dispatchers.IO) {
            runCatching {
                val reqBody = body?.toRequestBody(jsonType)
                val builder = Request.Builder().url(url).apply(authHeaders(token))
                when (method) {
                    "POST" -> builder.post(reqBody ?: "{}".toRequestBody(jsonType))
                    "PATCH" -> builder.patch(reqBody ?: "{}".toRequestBody(jsonType))
                    "DELETE" -> if (reqBody != null) builder.delete(reqBody) else builder.delete()
                    else -> builder.get()
                }
                http.newCall(builder.build()).execute().use { res ->
                    val text = res.body?.string().orEmpty()
                    if (!res.isSuccessful) error(parseError(text, res.code))
                    if (text.isBlank()) JsonObject(emptyMap()) else json.parseToJsonElement(text).jsonObject
                }
            }
        }

    private suspend fun requestElement(method: String, url: String, body: String?, token: String?, prefer: String?): Result<JsonElement> =
        withContext(Dispatchers.IO) {
            runCatching {
                val reqBody = body?.toRequestBody(jsonType)
                val builder = Request.Builder().url(url).apply(authHeaders(token))
                if (!prefer.isNullOrBlank()) builder.header("Prefer", prefer)
                when (method) {
                    "POST" -> builder.post(reqBody ?: "{}".toRequestBody(jsonType))
                    "PATCH" -> builder.patch(reqBody ?: "{}".toRequestBody(jsonType))
                    "DELETE" -> if (reqBody != null) builder.delete(reqBody) else builder.delete()
                    else -> builder.get()
                }
                http.newCall(builder.build()).execute().use { res ->
                    val text = res.body?.string().orEmpty()
                    if (!res.isSuccessful) error(parseError(text, res.code))
                    if (text.isBlank()) JsonNull else json.parseToJsonElement(text)
                }
            }
        }

    private fun parseError(text: String, code: Int): String {
        return runCatching {
            val obj = json.parseToJsonElement(text).jsonObject
            obj["msg"]?.jsonPrimitive?.contentOrNull
                ?: obj["error_description"]?.jsonPrimitive?.contentOrNull
                ?: obj["message"]?.jsonPrimitive?.contentOrNull
                ?: obj["error"]?.jsonPrimitive?.contentOrNull
                ?: "HTTP $code"
        }.getOrElse { if (text.isNotBlank()) text.take(160) else "HTTP $code" }
    }
}

fun JsonObject.str(key: String): String = this[key]?.jsonPrimitive?.contentOrNull ?: ""
fun JsonObject.strOrNull(key: String): String? = this[key]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
fun JsonObject.int(key: String): Int = this[key]?.jsonPrimitive?.intOrNull ?: 0
fun JsonObject.intOrNull(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull
fun JsonObject.long(key: String): Long = this[key]?.jsonPrimitive?.longOrNull ?: 0L
fun JsonObject.double(key: String): Double = this[key]?.jsonPrimitive?.doubleOrNull ?: 0.0
fun JsonObject.bool(key: String): Boolean = this[key]?.jsonPrimitive?.booleanOrNull ?: false
fun JsonObject.obj(key: String): JsonObject? = this[key] as? JsonObject
fun JsonObject.arr(key: String): JsonArray = this[key] as? JsonArray ?: JsonArray(emptyList())
fun JsonElement.asObjOrNull(): JsonObject? = this as? JsonObject
fun JsonElement.asArrOrEmpty(): JsonArray = this as? JsonArray ?: JsonArray(emptyList())
