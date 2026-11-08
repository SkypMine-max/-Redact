// Multi-platform message cleaner shell. Each platform lives in platforms/<name>.js
// and exposes: setup, connect, isConnected, listTargets, clean, logout.
// To add a platform: create a module with that interface and add it to P below.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const P = { discord: require("./platforms/discord"), instagram: require("./platforms/instagram") };
let win, running = false, stopFlag = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fromUI = (e) => String(e.senderFrame && e.senderFrame.url).startsWith("file://");
const GREEN = "\x1b[32m", RED = "\x1b[31m", RESET = "\x1b[0m";
const send = (m) => {
  if (m.type === "scan") console.log(GREEN + "[SCAN] " + m.text + RESET);
  else if (m.type === "del") console.log(RED + "[DELETED] " + m.text + RESET);
  try { win.webContents.send("ui:event", m); } catch {}
};

ipcMain.handle("ui:status", (e) => fromUI(e) ? Object.fromEntries(Object.entries(P).map(([k, p]) => [k, p.isConnected()])) : null);
ipcMain.handle("ui:connect", (e, id) => { if (fromUI(e) && P[id]) P[id].connect(); });
ipcMain.handle("ui:targets", (e, id) => (fromUI(e) && P[id] ? P[id].listTargets() : null));
ipcMain.handle("ui:stop", (e) => { if (fromUI(e)) stopFlag = true; });
ipcMain.handle("ui:start", async (e, { platform, targets, opts }) => {
  const p = P[platform];
  if (!fromUI(e) || !p || running || !p.isConnected()) return;
  running = true; stopFlag = false;
  const st = { deleted: 0, scanned: 0, fails: 0 };
  const c = { emit: (type, d = {}) => send({ type, ...d }), stopped: () => stopFlag, st };
  const o = { dryRun: opts.dryRun !== false, olderDays: Number(opts.olderDays) || 0, keyword: String(opts.keyword || ""), mode: opts.mode === "reactions" ? "reactions" : "messages" };
  try {
    for (const t of targets || []) { if (stopFlag || st.fails >= 5) break; await p.clean(t, o, c); }
    if (st.fails >= 5) c.emit("log", { text: "Stopped: the site rejected 5 requests in a row. Wait a while before retrying." });
  } catch (err) { c.emit("log", { text: "Error: " + err.message }); }
  c.emit("done", { deleted: st.deleted, scanned: st.scanned, dry: o.dryRun });
  running = false;
});

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1100, height: 760, title: "Redact", icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.js") },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (ev, url) => { if (!url.startsWith("file://")) ev.preventDefault(); });
  for (const p of Object.values(P)) p.setup((m) => send({ type: "conn", ...m }));
  win.loadFile(path.join(__dirname, "ui", "index.html"));
});
app.on("window-all-closed", () => app.quit());

// On quit: log out of every connected platform and wipe all stored data.
let quitting = false;
app.on("before-quit", async (event) => {
  if (quitting) return;
  event.preventDefault(); quitting = true; stopFlag = true;
  await Promise.all(Object.values(P).map((p) => Promise.race([p.logout(), sleep(4000)]).catch(() => {})));
  app.exit(0);
});
