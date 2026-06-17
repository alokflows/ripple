package com.ripple.app.util

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.EncodeHintType
import com.google.zxing.LuminanceSource
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.net.URLDecoder
import java.net.URLEncoder

/**
 * QR generation for pairing — byte-compatible with the web/desktop QR, which
 * encodes the auto-connect link `https://…/?room=<CODE>` (raw code; the relay
 * never sees it — clients hash it). Scanning that link on any Ripple client (or
 * a phone camera that opens the web app) joins the same room. Pure-Java + offline.
 */
object QrCodes {
    const val RELAY_WEB = "https://yap-mkk4.onrender.com"

    fun linkFor(code: String): String = "$RELAY_WEB/?room=" + URLEncoder.encode(code, "UTF-8")

    fun encode(text: String, size: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 1,
        )
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, hints)
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bmp.setPixel(x, y, if (matrix.get(x, y)) Color.BLACK else Color.WHITE)
            }
        }
        return bmp
    }

    /** Convenience: the pairing QR for a code at the given pixel size. */
    fun pairing(code: String, size: Int): Bitmap = encode(linkFor(code), size)

    // ---- Decoding (camera scanning) -------------------------------------------

    private val reader = QRCodeReader()
    private val decodeHints = mapOf(DecodeHintType.TRY_HARDER to true)

    /** Decode a QR from a luminance plane (a CameraX Y plane). Null if none found. */
    fun decode(source: LuminanceSource): String? = try {
        reader.decode(BinaryBitmap(HybridBinarizer(source)), decodeHints).text
    } catch (_: Exception) {
        null
    } finally {
        reader.reset()
    }

    /** Build a ZXing source straight from a camera Y plane (row stride aware). */
    fun yuvSource(data: ByteArray, rowStride: Int, width: Int, height: Int): LuminanceSource {
        val w = minOf(width, rowStride)
        return PlanarYUVLuminanceSource(data, rowStride, height, 0, 0, w, height, false)
    }

    /** Pull a pairing code out of a scanned payload: a `…/?room=CODE` link or a
     *  bare code. Returns null if it doesn't look like a Ripple code. */
    fun codeFromScan(raw: String): String? {
        val text = raw.trim()
        val idx = text.indexOf("room=")
        if (idx >= 0) {
            val tail = text.substring(idx + 5).takeWhile { it != '&' && it != '#' }
            val code = runCatching { URLDecoder.decode(tail, "UTF-8") }.getOrDefault(tail).trim()
            return code.ifBlank { null }
        }
        // A bare code (what someone might paste): short, no URL scheme.
        return if (text.isNotBlank() && text.length <= 64 && !text.contains("://")) text else null
    }
}
