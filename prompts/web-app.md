# 02 — Web app: symmetric model + E2E

Goal: update `server/public/index.html` (single-file app) to the new model.

## Do

1. **Adopt `packages/core`** semantics (or inline a faithful copy): hash the code
   to a `room`, derive the key, seal/unseal messages per `docs/security.md`.
2. **Symmetric UI:** drop "host". Every instance can send and receive. Replace
   the host-only "Allow others" with a shared **Lock room** toggle and a
   **per-device consent** control (auto / ask / off) for incoming text.
3. **Peer list:** show connected peers with their `deviceType` label and a live
   connected dot (driven by `peers` + heartbeat). One-tap remove/block.
4. **Keep** the mobile-keyboard fix, history, dictation, and PWA behavior intact.

## Don't

- Don't break the existing pairing/reconnect flow or the `?room=` invite links
  (derive the hash from the code those carry).

## Verify

- Phone ↔ computer exchange text both directions; relay logs show only
  ciphertext; wrong code → can't decrypt; lock + consent behave as specified.
</content>
