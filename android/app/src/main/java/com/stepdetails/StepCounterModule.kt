package com.stepdetails

import com.facebook.react.bridge.*
import com.google.android.gms.fitness.FitnessLocal
import com.google.android.gms.fitness.data.LocalDataType
import com.google.android.gms.fitness.request.LocalDataReadRequest
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import android.util.Log
class StepCounterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val context: ReactApplicationContext = reactContext

    override fun getName() = "StepCounterModule"

    @ReactMethod
    fun requestPermission(promise: Promise) {
        // Request permission for Activity Recognition (can be handled at the Android level)
        promise.resolve(true)
    }

    @ReactMethod
    fun subscribeToStepData(promise: Promise) {
        val localRecordingClient = FitnessLocal.getLocalRecordingClient(context)

        // Subscribe to step data
        localRecordingClient.subscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
            .addOnSuccessListener {
                promise.resolve("Subscribed to step data")
            }
            .addOnFailureListener { e ->
                promise.reject("SUBSCRIBE_ERROR", e.message)
            }
    }

    @ReactMethod
fun readStepData(promise: Promise) {
    val localRecordingClient = FitnessLocal.getLocalRecordingClient(context)

    // Define the time range for the data (last week)
    val endTime = LocalDateTime.now().atZone(ZoneId.systemDefault())
    val startTime = endTime.minusWeeks(1)

    val readRequest = LocalDataReadRequest.Builder()
        .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
        .bucketByTime(1, TimeUnit.DAYS)  // Bucket by 1-day intervals
        .setTimeRange(startTime.toEpochSecond(), endTime.toEpochSecond(), TimeUnit.SECONDS)
        .build()

    // Read the step data
    localRecordingClient.readData(readRequest)
        .addOnSuccessListener { response ->
            val stepData = response.buckets.flatMap { it.dataSets }
                .flatMap { dataSet ->
                    dataSet.dataPoints.map { dataPoint ->
                        // Use asInt() instead of asDouble() for step count, as it's an integer value
                        val steps = dataPoint.getValue(dataPoint.dataType.fields.first()).asInt()
                        val map = Arguments.createMap().apply {
                            putDouble("startTime", dataPoint.getStartTime(TimeUnit.MILLISECONDS).toDouble())
                            putDouble("endTime", dataPoint.getEndTime(TimeUnit.MILLISECONDS).toDouble())
                            putInt("steps", steps)  // Store the steps as an integer
                        }
                        map
                    }
                }

            // Create a WritableArray
            val writableArray = Arguments.createArray()
            stepData.forEach { map ->
                writableArray.pushMap(map)  // Add each WritableMap to the array
            }

            // Resolve the promise with the WritableArray
            promise.resolve(writableArray)
        }
        .addOnFailureListener { e ->
            promise.reject("READ_ERROR", e.message)
        }
}




    @ReactMethod
    fun unsubscribe(promise: Promise) {
        val localRecordingClient = FitnessLocal.getLocalRecordingClient(context)

        // Unsubscribe from step data
        localRecordingClient.unsubscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
            .addOnSuccessListener {
                promise.resolve("Unsubscribed from step data")
            }
            .addOnFailureListener { e ->
                promise.reject("UNSUBSCRIBE_ERROR", e.message)
            }
    }
}
