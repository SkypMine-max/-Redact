// Discord module. Login on Discord's page; calls then go Discrub-style
// (API v10, 3 plain headers, no cookies). Session is in memory only.
const { BrowserWindow, session } = require("electron");
const id = "discord", PARTITION = "discord-temp";
const API = "https://discord.com/api/v10", WEB_API = "https://discord.com/api/v9";
const API_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:17.0) Gecko/20121202 Firefox/17.0 Iceweasel/17.0.1";
const UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const COPY = ["x-super-properties", "x-discord-locale", "x-discord-timezone"];
let ses, win = null, me = null, notify, verifying = false, connected = false, creds = { token: null, headers: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const snip = async (r) => (await r.text().catch(() => "")).slice(0, 200);
const nm = (u) => u.global_name || u.username;
const preview = (m) => {
  const t = String(m.content || "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 80) : "[attachment/embed]";
};

const emojiPath = (e) => encodeURIComponent(e.id ? `${e.name}:${e.id}` : e.name);
const emojiLabel = (e) => (e.id ? `:${e.name}:` : e.name);

async function api(method, ep) {
  for (;;) {
    const r = await fetch(API + ep, { method, headers: { "Content-Type": "application/json", authorization: creds.token, "user-agent": API_UA } });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); await sleep(Number(j.retry_after || 1) * 1000 + 250); continue; }
    return r;
  }
}
async function getJson(ep) { const r = await api("GET", ep); if (!r.ok) throw new Error(`${ep} -> ${r.status}`); return r.json(); }

async function verify() {
  if (verifying || connected) return; verifying = true;
  try {
    const r = await api("GET", "/users/@me");
    if (!r.ok) throw new Error("bad token");
    me = await r.json(); connected = true;
    if (win && !win.isDestroyed()) win.close();
    notify(true);
  } catch { creds.token = null; }
  verifying = false;
}
function setup(n) {
  notify = (c) => n({ platform: id, connected: c });
  ses = session.fromPartition(PARTITION);
  ses.webRequest.onBeforeSendHeaders({ urls: ["https://discord.com/api/*"] }, (d, cb) => {
    for (const [k, v] of Object.entries(d.requestHeaders)) {
      const l = k.toLowerCase();
      if (l === "authorization" && typeof v === "string" && v.length > 10) creds.token = v;
      else if (COPY.includes(l)) creds.headers[k] = v;
    }
    cb({ requestHeaders: d.requestHeaders });
    if (creds.token && !connected) setTimeout(verify, 1200);
  });
}
function connect() {
  if (win && !win.isDestroyed()) return win.focus();
  win = new BrowserWindow({ width: 520, height: 780, title: "Log in to Discord", webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true } });
  win.webContents.setUserAgent(UA);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadURL("https://discord.com/login");
}
async function listTargets() {
  const [dms, guilds] = await Promise.all([getJson("/users/@me/channels"), getJson("/users/@me/guilds")]);
  const av = (u) => (u && u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null);
  return {
    me: nm(me),
    groups: [
      { label: "Direct Messages", items: dms.filter((c) => c.type === 1 || c.type === 3)
        .sort((a, b) => { const x = BigInt(a.last_message_id || 0), y = BigInt(b.last_message_id || 0); return y > x ? 1 : y < x ? -1 : 0; })
        .map((c) => ({ kind: "dm", id: c.id, name: c.name || c.recipients.map(nm).join(", ") || "Unknown", icon: c.type === 1 ? av(c.recipients[0]) : null })) },
      { label: "Servers", items: guilds.map((g) => ({ kind: "guild", id: g.id, name: g.name, icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null })) },
    ],
  };
}
async function guildChannels(g, c) {
  const r = await api("GET", `/guilds/${g.id}/channels`);
  if (!r.ok) { c.emit("log", { text: `${g.name}: can't list channels (${r.status})` }); return []; }
  const list = (await r.json()).filter((x) => [0, 2, 5].includes(x.type));
  const t = await api("GET", `/guilds/${g.id}/threads/active`);
  if (t.ok) list.push(...(((await t.json()).threads) || []));
  return list.map((x) => ({ id: x.id, name: `${g.name} › ${x.name}` }));
}
async function cleanChannel(ch, o, c) {
  const cutoff = o.olderDays > 0 ? Date.now() - o.olderDays * 864e5 : null, kw = o.keyword.toLowerCase(), st = c.st;
  let before = null, found = 0;
  c.emit("target", { text: ch.name });
  while (!c.stopped() && st.fails < 5) {
    const r = await api("GET", `/channels/${ch.id}/messages?limit=100${before ? `&before=${before}` : ""}`);
    if (!r.ok) { if (r.status !== 403 && r.status !== 404) { st.fails++; c.emit("log", { text: `${ch.name}: read error ${r.status} ${await snip(r)}` }); } break; }
    const batch = await r.json(); if (!batch.length) break;
    for (const m of batch) {
      if (c.stopped() || st.fails >= 5) break;
      st.scanned++;
      c.emit("scan", { text: `${ch.name}: ${preview(m)}` }); // green
      if (o.mode === "reactions") { // remove MY reactions (on anyone's messages)
        if (!m.reactions || !m.reactions.length) continue;
        if (cutoff && Date.parse(m.timestamp) > cutoff) continue;
        if (kw && !String(m.content || "").toLowerCase().includes(kw)) continue;
        for (const rx of m.reactions) {
          for (const burst of [false, true]) {
            if (!(burst ? rx.me_burst : rx.me)) continue;
            if (c.stopped() || st.fails >= 5) break;
            found++;
            const label = `${ch.name}: ${emojiLabel(rx.emoji)}${burst ? " (super)" : ""} on ${preview(m)}`;
            if (o.dryRun) { st.deleted++; c.emit("stats", st); continue; }
            const base = `/channels/${ch.id}/messages/${m.id}/reactions/${emojiPath(rx.emoji)}`;
            // Normal reactions: .../@me. Super reactions use a different route (type 1); try the known forms and verify it's really gone.
            const tries = burst ? [`${base}/1/@me`, `${base}/@me?type=1`] : [`${base}/@me`];
            let ok = false, lastStatus = 0, lastBody = "";
            for (const ep of tries) {
              const d = await api("DELETE", ep); lastStatus = d.status;
              if (d.status !== 204) { lastBody = await snip(d); continue; }
              if (!burst) { ok = true; break; }
              await sleep(400);
              const chk = await api("GET", `/channels/${ch.id}/messages?around=${m.id}&limit=1`);
              const cm = chk.ok ? ((await chk.json()).find((x) => x.id === m.id)) : null;
              const still = cm && (cm.reactions || []).some((y) => y.me_burst && (y.emoji.id || y.emoji.name) === (rx.emoji.id || rx.emoji.name));
              if (!still) { ok = true; break; }
              lastBody = "204 but the super reaction is still there";
            }
            if (ok) { st.deleted++; st.fails = 0; c.emit("del", { text: label }); } else { st.fails++; c.emit("log", { text: `failed (${lastStatus}): ${lastBody}` }); }
            c.emit("stats", st);
            await sleep(rand(450, 900));
          }
        }
        continue;
      }
      if (m.author?.id !== me.id || ![0, 19].includes(m.type)) continue;
      if (cutoff && Date.parse(m.timestamp) > cutoff) continue;
      if (kw && !String(m.content || "").toLowerCase().includes(kw)) continue;
      found++;
      if (o.dryRun) { st.deleted++; c.emit("stats", st); continue; }
      const d = await api("DELETE", `/channels/${ch.id}/messages/${m.id}`);
      if (d.status === 204) { st.deleted++; st.fails = 0; c.emit("del", { text: `${ch.name}: ${preview(m)}` }); } else { st.fails++; c.emit("log", { text: `failed (${d.status}): ${await snip(d)}` }); }
      c.emit("stats", st);
      await sleep(rand(900, 1600));
    }
    before = batch[batch.length - 1].id; await sleep(rand(300, 700));
  }
  if (found) c.emit("log", { text: `${ch.name}: ${o.dryRun ? "found" : "processed"} ${found}` });
}
async function clean(t, o, c) {
  const chans = t.kind === "guild" ? await guildChannels(t, c) : [{ id: t.id, name: t.name }];
  for (const ch of chans) { if (c.stopped() || c.st.fails >= 5) break; await cleanChannel(ch, o, c); }
}
async function logout() {
  try {
    if (creds.token) await ses.fetch(`${WEB_API}/auth/logout`, { method: "POST", headers: { ...creds.headers, Authorization: creds.token, "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify({ provider: null, voip_provider: null }) });
  } catch {}
  try { await ses.clearStorageData(); await ses.clearCache(); } catch {}
  creds = { token: null, headers: {} }; connected = false;
}
module.exports = { id, setup, connect, isConnected: () => connected, listTargets, clean, logout };
