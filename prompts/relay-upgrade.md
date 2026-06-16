# 01 — Relay upgrade

Goal: evolve `server/server.js` to fully implement **protocol v1**
(`docs/protocol.md`) while staying a blind, stateless, in-memory router.

## Do

1. **Handshake:** accept `hello` with `proto`, `room` (already a hash from the
   client), `did`, `name`, `os`, `deviceType`, `caps`. Reply `welcome` with the
   connection `id` and current `peers`. Broadcast `peers` on every join/leave.
2. **Routing:** group by `room`. Forward `msg`/`history` frames **verbatim** to
   the other peers — never inspect `ciphertext`. Reply `ack` with delivered count.
3. **Heartbeat:** `ping`/`pong`; drop after 2 missed beats; rebroadcast `peers`.
4. **Lock:** handle `setLock`; refuse new `hello`s from unknown `did`s when
   locked; always allow a known `did` to reconnect. Broadcast lock state.
5. **History:** keep a small in-memory ring per room of sealed frames; replay on
   join. Evict rooms after 12h idle. Nothing touches disk.
6. **Safety:** message size cap, basic per-connection rate limit → `error`
   frames (`tooBig`, `rateLimited`). Keep `/poll` and `/healthz` working.

## Don't

- Don't add a database. Don't log plaintext (there is none). Don't change the
  deploy layout. Don't introduce a host concept.

## Verify

- Two `wscat`/web clients in the same room exchange sealed frames; a third in a
  different room sees nothing. Lock blocks a new device but not a reconnect.
- Update `docs/protocol.md` if any field changed.
</content>
