package com.skylightlim.umpoint

import android.app.Application
import com.skylightlim.umpoint.sniper.SniperScheduler
import com.skylightlim.umpoint.sniper.SniperService

class UmpointApp : Application() {
    override fun onCreate() {
        super.onCreate()
        SniperService.channels(this)
        SniperScheduler.reschedule(this)
    }
}
