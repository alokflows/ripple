import WebSocket from 'ws';
const WSU = 'ws://localhost:8099', S='http://localhost:8099';
const CODE = 'DESTROYME';
const mk = (role, did) => new WebSocket(`${WSU}/ws?role=${role}&room=${CODE}&did=${did}`);
const evs = [];
const host = mk('desktop','HOST'); const guest = mk('phone','GUEST');
const log = (who) => (d)=>{const m=JSON.parse(d);if(['destroyed','kicked'].includes(m.type))evs.push(who+':'+m.type);};
host.on('message', log('host')); guest.on('message', log('guest'));
await Promise.all([new Promise(r=>host.on('open',r)), new Promise(r=>guest.on('open',r))]);
host.send(JSON.stringify({type:'text',text:'hi'}));
await new Promise(r=>setTimeout(r,150));
// non-host tries to destroy -> ignored
guest.send(JSON.stringify({type:'destroy'}));
await new Promise(r=>setTimeout(r,150));
console.log('after non-host destroy attempt, events:', JSON.stringify(evs));
const poll1 = await (await fetch(`${S}/poll/${CODE}/0`)).text();
console.log('room still alive (has msg):', poll1);
// host destroys
host.send(JSON.stringify({type:'destroy'}));
await new Promise(r=>setTimeout(r,200));
console.log('after host destroy, events:', JSON.stringify(evs));
const poll2 = await (await fetch(`${S}/poll/${CODE}/0`)).text();
console.log('room freed (empty):', poll2);
process.exit(0);
