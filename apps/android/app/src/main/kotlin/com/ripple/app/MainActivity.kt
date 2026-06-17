package com.ripple.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import com.ripple.app.ui.RippleApp

/**
 * The container app: a website-identical pairing + chat screen (and, later, the
 * keyboard setup wizard and settings). It shares the one socket with the
 * keyboard via [RippleRepository].
 */
class MainActivity : ComponentActivity() {
    private val vm: RippleViewModel by viewModels()

    private val requestNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* best-effort */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        RippleRepository.init(applicationContext)
        maybeAskForNotifications()
        enableEdgeToEdge()
        setContent { RippleApp(vm) }
    }

    /** The foreground "connected" notification needs this on Android 13+. */
    private fun maybeAskForNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) requestNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
