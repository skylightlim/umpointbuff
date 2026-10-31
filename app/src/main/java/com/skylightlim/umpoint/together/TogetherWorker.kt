package com.skylightlim.umpoint.together

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** The safety net under push: picks up missed changes and reports midnight's results. */
class TogetherWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        if (!Together.configured || !Together.signedIn(applicationContext)) return@withContext Result.success()
        try {
            Together.sync(applicationContext)
            Result.success()
        } catch (e: TogetherError) {
            if (e.signedOut) Result.success() else Result.retry()
        }
    }

    companion object {
        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                "together-sync",
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<TogetherWorker>(3, TimeUnit.HOURS).setConstraints(online).build(),
            )
        }

        fun now(ctx: Context) {
            WorkManager.getInstance(ctx).enqueueUniqueWork(
                "together-sync-now",
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<TogetherWorker>().setConstraints(online).build(),
            )
        }
    }
}
