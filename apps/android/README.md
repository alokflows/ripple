# Ripple Keyboard — Android (+ TV)

A standalone keyboard (forked from **FlorisBoard**, Apache-2.0) with a built-in
**Ripple panel**: pair, see history, and have spoken/typed text appear at the cursor
in any app. The same signed APK targets phones and Android TV (leanback). Ships
alongside a full container app.

**Build instructions:** [`/prompts/android.md`](../../prompts/android.md)
**Contract:** [`/docs/protocol.md`](../../docs/protocol.md) · [`/docs/security.md`](../../docs/security.md)

## Status

**In progress — app + keyboard build via CI; not yet device-tested.** What's here:

- Gradle project (`:app`, AGP 8.7 / Kotlin 2.1 / Compose, `minSdk 26`).
- `net/RippleClient.kt` — the single OkHttp WebSocket peer speaking the relay
  protocol (HANDOFF §4): seals/unseals AES-GCM blobs, routes on the room hash,
  optimistic send (never blocks the input path), id-correlated acks, backoff
  reconnect, terminal kicked/full/locked.
- `RippleRepository` — process-wide owner of the **one** socket, so the app and
  the keyboard share a single WebSocket + history (pair in the app → keyboard
  lights up). `RippleConnectionService` (foreground, `dataSync`) keeps it alive
  while only the keyboard is on screen.
- **`ime/RippleImeService` — the Ripple keyboard.** A working compact keyboard
  plus the Ripple panel: received text shows as chips that **insert at the
  cursor** on tap, and what you type **sends to your other devices** with the
  Ripple key. (Native key grid for now — a FlorisBoard-grade layout can replace
  it later without touching the panel/plumbing.)
- `RippleViewModel` + Compose UI (`ui/`) — Connect + Chat screens, warm-clay M3.
- Shared crypto: reuses `packages/core-kt` **by source** (`sourceSets` srcDir),
  so `RippleCrypto` can't drift from the JS/Rust mirrors or the cross-language
  vectors. `minSdk 26` is required by its `java.util.Base64` / PBKDF2 usage.
- Launcher + TV banner + status icon (placeholder clay-bubble vectors —
  regenerate from the canonical `server/public/icon.svg` later).

### Try the keyboard (on a device/emulator — can't be done in CI)
Install the `ripple-debug-apk`, open the app and pair with a code, then
Settings → System → Languages & input → enable **Ripple Keyboard** and pick it.

### Still to build
- **Richer key layout** (symbols/emoji/long-press, or vendor FlorisBoard).
- A **keyboard setup wizard** + **Settings** (consent mode auto/ask/off, theme).
- Compose **QR scan** to pair, on-device **dictation** → send.
- **History encrypted at rest** (EncryptedSharedPreferences).
- TV D-pad polish; replace placeholder icon with the canonical bubble.

## Build / verify

No Android SDK in the agent sandbox, so **CI is the source of truth**:
`.github/workflows/android-build.yml` assembles a debug APK on every push that
touches `apps/android/**` or `packages/core-kt/**` (artifact: `ripple-debug-apk`).

Locally (on a machine with the Android SDK + JDK 17):

```sh
cd apps/android
gradle :app:assembleDebug      # or ./gradlew once a wrapper is added
```

## Distribution (no Play Store)

`gradle assembleRelease` → signed APK → sideload to phone/TV. Keystore handling
(base64 in a GitHub secret + a release workflow) lands with the IME.
