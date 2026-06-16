// Run: node --test packages/core/crypto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, roomFromCode, keyFromCode, seal, unseal } from './crypto.mjs';

test('round-trips text with the same code', async () => {
  const key = await keyFromCode('K7QF9P');
  const blob = await seal(key, 'hello, cursor 👋');
  assert.equal(await unseal(key, blob), 'hello, cursor 👋');
});

test('a different code cannot decrypt (returns null, never throws)', async () => {
  const blob = await seal(await keyFromCode('K7QF9P'), 'secret');
  assert.equal(await unseal(await keyFromCode('WRONG1'), blob), null);
});

test('tampered ciphertext is rejected', async () => {
  const key = await keyFromCode('K7QF9P');
  let blob = await seal(key, 'do not change me');
  blob = blob.slice(0, -2) + (blob.endsWith('A') ? 'BB' : 'AA'); // flip the end
  assert.equal(await unseal(key, blob), null);
});

test('room id is deterministic and hides the code', async () => {
  const a = await roomFromCode('K7QF9P');
  const b = await roomFromCode('k7qf9p'); // normalized to the same thing
  assert.equal(a, b);
  assert.notEqual(a.toUpperCase(), 'K7QF9P'); // it is a hash, not the code
  assert.match(a, /^[A-Za-z0-9_-]+$/); // base64url, relay-safe
});

test('different codes produce different rooms', async () => {
  assert.notEqual(await roomFromCode('AAAAAA'), await roomFromCode('BBBBBB'));
});

test('each seal uses a fresh nonce (no repeats)', async () => {
  const key = await keyFromCode('K7QF9P');
  assert.notEqual(await seal(key, 'same'), await seal(key, 'same'));
});

test('normalizeCode strips noise and upper-cases', () => {
  assert.equal(normalizeCode(' k7-qf 9p '), 'K7QF9P');
});
