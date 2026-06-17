const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
const els = {
  code: $("code"), connect: $("connectBtn"), disconnect: $("disconnectBtn"),
  pairConnect: $("pairConnect"), pairConnected: $("pairConnected"), codeDisplay: $("codeDisplay"),
  status: $("status"), statusText: $("statusText"),
  tabChat: $("tabChat"), tabDevices: $("tabDevices"),
  panelChat: $("panelChat"), panelDevices: $("panelDevices"),
  type: $("typeChk"), autoCopy: $("autoCopyChk"), undo: $("undoBtn"),
  feed: $("feed"), msg: $("msg"), send: $("sendBtn"),
  devices: $("devices"), devicesEmpty: $("devicesEmpty"),
  sheet: $("sheet"), sheetPreview: $("sheetPreview"), sheetCopy: $("sheetCopy"), sheetResend: $("sheetResend"), sheetCancel: $("sheetCancel"),
  toast: $("toast"),
};

let connected = false;

function setConnected(on) {
  connected = on;
  els.pairConnect.classList.toggle("hidden", on);
  els.pairConnected.classList.toggle("hidden", !on);
}
function setStatus(state, text) {
  els.status.dataset.state = state;
  els.statusText.textContent = text;
}

let toastTimer = null;
function toast(text, kind = "") {
  els.toast.textContent = text;
  els.toast.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.className = "toast " + kind), 1700);
}

// ---- chat feed ----
function addMessage(dir, text, delivered) {
  const empty = els.feed.querySelector(".feed-empty");
  if (empty) empty.remove();
  const li = document.createElement("li");
  li.className = "bubble " + (dir === "out" ? "out" : "in");
  li._text = text;
  const t = document.createElement("div");
  t.className = "txt";
  t.textContent = text;
  li.appendChild(t);
  if (dir === "out") {
    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = delivered > 0 ? `✓ ${delivered} device${delivered > 1 ? "s" : ""}` : "sent";
    li.appendChild(m);
  }
  els.feed.appendChild(li);
  els.feed.scrollTop = els.feed.scrollHeight;
}

// ---- tabs ----
function setTab(tab) {
  els.tabChat.setAttribute("aria-selected", String(tab === "chat"));
  els.tabDevices.setAttribute("aria-selected", String(tab === "devices"));
  els.panelChat.classList.toggle("hidden", tab !== "chat");
  els.panelDevices.classList.toggle("hidden", tab !== "devices");
}
els.tabChat.addEventListener("click", () => setTab("chat"));
els.tabDevices.addEventListener("click", () => setTab("devices"));

// ---- connect / disconnect ----
async function doConnect() {
  const code = els.code.value.trim();
  if (!code) { toast("Enter a code", "bad"); return; }
  try {
    await invoke("connect", { code });
    els.codeDisplay.textContent = code.toUpperCase();
    setConnected(true);
    setStatus("connecting", "Connecting…");
  } catch (e) { toast(String(e), "bad"); }
}
async function doDisconnect() {
  try { await invoke("disconnect"); } catch {}
  setConnected(false);
  setStatus("offline", "Not connected");
  els.devices.innerHTML = "";
  els.devicesEmpty.classList.remove("hidden");
}
els.connect.addEventListener("click", doConnect);
els.disconnect.addEventListener("click", doDisconnect);
els.code.addEventListener("keydown", (e) => { if (e.key === "Enter") doConnect(); });

// ---- toggles ----
els.type.addEventListener("change", () => invoke("set_type_at_cursor", { on: els.type.checked }));
els.autoCopy.addEventListener("change", () => invoke("set_auto_copy", { on: els.autoCopy.checked }));
els.undo.addEventListener("click", () => { invoke("undo"); toast("Undid last paste"); });

// ---- send ----
els.msg.addEventListener("input", () => (els.send.disabled = !els.msg.value.trim()));
async function doSend(text) {
  const t = (text ?? els.msg.value).trim();
  if (!t) return;
  try {
    await invoke("send_text", { text: t });
    if (text == null) { els.msg.value = ""; els.send.disabled = true; }
  } catch (e) { toast(String(e), "bad"); }
}
els.send.addEventListener("click", () => doSend());
els.msg.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend(); });

// ---- per-message sheet (right-click) ----
let sheetText = null;
function openSheet(text) {
  sheetText = text;
  els.sheetPreview.textContent = text;
  els.sheet.hidden = false;
  requestAnimationFrame(() => els.sheet.classList.add("show"));
}
function closeSheet() {
  els.sheet.classList.remove("show");
  setTimeout(() => { els.sheet.hidden = true; sheetText = null; }, 180);
}
els.feed.addEventListener("contextmenu", (e) => {
  const li = e.target.closest("li.bubble");
  if (!li) return;
  e.preventDefault();
  openSheet(li._text);
});
els.sheetCopy.addEventListener("click", () => { if (sheetText != null) { invoke("copy_to_clipboard", { text: sheetText }); toast("Copied ✓", "good"); } closeSheet(); });
els.sheetResend.addEventListener("click", () => { const t = sheetText; closeSheet(); if (t) doSend(t); });
els.sheetCancel.addEventListener("click", closeSheet);
els.sheet.addEventListener("click", (e) => { if (e.target === els.sheet) closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !els.sheet.hidden) closeSheet(); });

// ---- devices ----
const OS_ICON = {
  Windows: "🪟", macOS: "💻", iOS: "📱", Android: "📱", Linux: "🐧", Device: "🖥️",
};
function renderDevices(list) {
  els.devices.innerHTML = "";
  if (!list.length) { els.devicesEmpty.classList.remove("hidden"); return; }
  els.devicesEmpty.classList.add("hidden");
  for (const d of list) {
    const row = document.createElement("div");
    row.className = "device" + (d.is_me ? " me" : "");
    const kind = d.os === "iOS" || d.os === "Android" ? "Phone" : d.os !== "Device" ? "Computer" : "Device";
    row.innerHTML = `<span class="dev-os">${OS_ICON[d.os] || OS_ICON.Device}</span>
      <span class="dev-info"><span class="dev-name">${d.name}</span>
      <span class="dev-sub">${kind}${d.is_me ? " · this device" : ""}${d.is_host ? ' · <b class="host">host</b>' : ""}</span></span>`;
    els.devices.appendChild(row);
  }
}

// ---- events from Rust ----
listen("yap://status", (e) => {
  const { state, devices, error } = e.payload;
  if (state === "connected") setStatus("connected", devices > 0 ? `${devices} device${devices > 1 ? "s" : ""}` : "Waiting for your phone…");
  else if (state === "connecting") setStatus("connecting", "Connecting…");
  else { setStatus("offline", error || (connected ? "Reconnecting…" : "Not connected")); if (error) toast(error, "bad"); }
});
listen("yap://message", (e) => {
  const { dir, text, delivered } = e.payload;
  addMessage(dir, text, delivered || 0);
});
listen("yap://devices", (e) => renderDevices(e.payload || []));

// ---- init ----
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const s = await invoke("get_settings");
    els.type.checked = s.type_at_cursor;
    els.autoCopy.checked = s.auto_copy;
  } catch {}
  setTab("chat");
  setConnected(false);
  setStatus("offline", "Not connected");
});
