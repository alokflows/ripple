import WebSocket from 'ws';
const S = 'http://localhost:8099', WSU = 'ws://localhost:8099';
const CODE = 'TESTLOCK';
const poll = async (did) => {
  const u = `${S}/poll/${CODE}/0${did ? `?did=${did}` : ''}`;
  const r = await fetch(u);
  const body = await r.text();
  return { status: r.status, body };
};
const host = new WebSocket(`${WSU}/ws?role=desktop&room=${CODE}&did=HOSTDID`);
await new Promise(res => host.on('open', res));
host.send(JSON.stringify({ type: 'text', text: 'hello world' }));
await new Promise(r => setTimeout(r, 150));

console.log('open + helper polls (remembers HELPERDID):', JSON.stringify(await poll('HELPERDID')));
host.send(JSON.stringify({ type: 'setOpen', open: false })); // LOCK
await new Promise(r => setTimeout(r, 150));

console.log('locked, known HELPERDID:', JSON.stringify(await poll('HELPERDID')));
console.log('locked, stranger STRANGER:', JSON.stringify(await poll('STRANGER')));
console.log('locked, NO did:', JSON.stringify(await poll(null)));
host.close();
process.exit(0);
