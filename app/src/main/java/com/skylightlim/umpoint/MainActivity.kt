package com.skylightlim.umpoint

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.skylightlim.umpoint.ui.AppRoot
import com.skylightlim.umpoint.ui.theme.UmpointTheme

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (savedInstanceState == null) handle(intent)
        setContent {
            UmpointTheme {
                AppRoot(vm)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent) {
        // Developer checks over adb: a dry run books nothing, and the demo only exists in debug builds.
        if (intent.getBooleanExtra("umpoint_dry_run", false)) vm.startHiddenTestRun()
        if (BuildConfig.DEBUG) {
            intent.getStringExtra("umpoint_demo")?.let { scene ->
                setShowWhenLocked(true)
                setTurnScreenOn(true)
                vm.startDemo(scene)
            }
        }
    }
}
