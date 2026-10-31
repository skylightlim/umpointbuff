package com.skylightlim.umpoint

import android.app.Application
import com.skylightlim.umpoint.sniper.SniperScheduler
import com.skylightlim.umpoint.sniper.SniperService
import com.skylightlim.umpoint.together.TogetherPush
import com.skylightlim.umpoint.together.TogetherWorker

class UmpointApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SniperService.channels(this)
        SniperScheduler.reschedule(this)
        // Kept apart so nothing about Play together can stop the sniper's alarm being set above.
        runCatching {
            TogetherPush.channels(this)
            TogetherPush.init(this)
            TogetherWorker.schedule(this)
        }
    }
}
