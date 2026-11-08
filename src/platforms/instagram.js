// Instagram module (DMs). Log in on Instagram's own page, then drive that page like a person would:
// open a chat, hover each message, click "More" -> "Unsend" -> confirm (DOM automation, no private API).
// Session lives in memory only. Instagram's page layout can change, so this is best-effort and untested.
const { BrowserWindow, session } = require("electron");
const fs = require("fs"), path = require("path");
const id = "instagram", PARTITION = "instagram-temp", IG = "https://www.instagram.com";
const UA = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;
const SHOW_BROWSER = true; // keep Instagram's window visible while it works (set false to hide it)
const INJECT = fs.readFileSync(path.join(__dirname, "ig-inject.js"), "utf8");
let ses, win = null, notify, connected = false, finishing = false, myId = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const say = (text) => { try { notify({ type: "log", text }); } catch {} };
const run = (code) => win.webContents.executeJavaScript(code);
const inject = () => run(INJECT);
// A REAL mouse click (sent by Electron, not a scripted one) at page coordinates. Instagram ignores some scripted clicks.
async function trustedClick(pt) {
  if (!pt) return false;
  const wc = win.webContents;
  try { wc.focus(); } catch {}
  wc.sendInputEvent({ type: "mouseMove", x: pt.x, y: pt.y });
  await sleep(30);
  wc.sendInputEvent({ type: "mouseDown", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(30);
  wc.sendInputEvent({ type: "mouseUp", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
  await sleep(100);
  return true;
}

async function openPage(url) {
  await win.loadURL(url).catch(() => {});
  await sleep(3500);
  await inject();
  await run("__mc.dismiss()");
}
async function finish() {
  if (finishing || connected) return; finishing = true;
  myId = ((await ses.cookies.get({ name: "ds_user_id" }))[0] || {}).value || null;
  await openPage(IG + "/direct/inbox/");
  connected = true; finishing = false; if (!SHOW_BROWSER) win.hide(); notify(true);
}
function setup(n) {
  notify = (c) => n({ platform: id, connected: c });
  ses = session.fromPartition(PARTITION);
  ses.cookies.on("changed", (_e, ck, _cause, removed) => {
    if (ck.name === "sessionid" && String(ck.domain).includes("instagram.com") && !removed && !connected && !finishing && win && !win.isDestroyed()) finish();
  });
}
function connect() {
  if (win && !win.isDestroyed()) { win.show(); return win.focus(); }
  win = new BrowserWindow({ width: 1400, height: 900, title: "Instagram", webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  win.webContents.setUserAgent(UA);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.loadURL(IG + "/accounts/login/");
}
async function listTargets() {
  // "Everything" always works (it walks the inbox itself). The per-chat list is best-effort.
  const items = [{ kind: "dm", id: "all", icon: null, name: "ALL conversations (works through the whole inbox, newest first)" }];
  say("Loading Instagram chats...");
  try {
    await openPage(IG + "/direct/inbox/");
    const chats = await run("__mc.chats()");
    chats.forEach((c) => items.push({ kind: "dm", id: c.id, icon: null, name: c.name }));
    say(`Found ${chats.length} individual chats${chats.length ? ": " + chats.slice(0, 8).map((x) => x.name).join(", ") + (chats.length > 8 ? ", ..." : "") : ""}`);
  } catch (e) { say("Couldn't list individual chats (" + e.message + "). Use the ALL option."); }
  const activity = Object.entries(ACT).map(([k, v]) => ({ kind: "activity", id: k, icon: null, name: v.name }));
  return { me: "user " + (myId || "?"), groups: [{ label: "Chats", items }, { label: "Account activity", items: activity }] };
}
// Dismisses error popups ("Something went wrong" -> OK / Try again). Runs in the background while cleaning, and is also called after failures.
async function dismissErrors(c) {
  let any = false;
  try {
    for (let i = 0; i < 3 && win && !win.isDestroyed(); i++) {
      const e = await run("__mc.errorPoint()");
      if (!e || !e.pt) break;
      any = true;
      if (c) c.emit("log", { text: `Instagram showed an error ("${preview(e.text)}"): clicking "${e.label}"` });
      await trustedClick(e.pt); await sleep(600);
      if (e.rate) { if (c) c.emit("log", { text: "Looks like a rate limit: pausing 20 seconds." }); await sleep(20000); }
    }
  } catch {}
  return any;
}
let watchTimer = null, watchBusy = false;
function startWatch(c) {
  if (watchTimer) return;
  watchTimer = setInterval(async () => { if (watchBusy) return; watchBusy = true; try { await dismissErrors(c); } catch {} watchBusy = false; }, 2500);
}
function stopWatch() { clearInterval(watchTimer); watchTimer = null; }
const preview = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 80);

// Unsends my messages in whichever chat is currently open.
async function unsendInOpenChat(label, o, c) {
  const st = c.st, kw = o.keyword.toLowerCase();
  let found = 0; const s0 = st.scanned;
  await run("__mc.waitMessages()");
  const loaded = await run("__mc.loadAll()");
  if (!loaded.ok && !loaded.rows) {
    c.emit("log", { text: `${label}: couldn't find the message list. Page diagnostics: ${JSON.stringify(await run("__mc.msgDiag()"))}` });
    return false;
  }
  c.emit("log", { text: `${label}: loaded ${loaded.rows} messages` });
  while (!c.stopped() && st.fails < 5) {
    const m = await run("__mc.next()");
    if (m.done) break;
    st.scanned++;
    c.emit("scan", { text: `${label}: ${preview(m.preview)}` }); // green
    if (!m.mine) { c.emit("stats", st); continue; }
    if (kw && !String(m.preview).toLowerCase().includes(kw)) { await run("__mc.skip()"); continue; }
    found++;
    if (o.dryRun) { await run("__mc.skip()"); st.deleted++; c.emit("stats", st); continue; }
    const d = await run("__mc.unsend()");
    if (d.ok) { st.deleted++; st.fails = 0; c.emit("del", { text: `${label}: ${preview(m.preview)}` }); } // red, only on a real unsend
    else {
      await run("__mc.skip()"); await dismissErrors(c);
      const rq = await run("__mc.requeue()");
      if (!rq) st.fails++;
      c.emit("log", { text: `failed to unsend (${d.reason})${rq ? ", retrying once" : ""}` });
    }
    c.emit("stats", st);
    await sleep(rand(500, 1100));
  }
  c.emit("log", { text: `${label}: scanned ${st.scanned - s0} messages, ${o.dryRun ? "found" : "processed"} ${found} of yours` });
  return true;
}

// Real mouse-wheel scroll over the chat (fallback when scripted scrolling does nothing). Works out which wheel direction is "up" by watching a message move.
let wheelSign = 1;
async function wheel(sign, n) {
  const pt = await run("__mc.panePoint()"); if (!pt) return;
  const wc = win.webContents; try { wc.focus(); } catch {}
  wc.sendInputEvent({ type: "mouseMove", x: pt.x, y: pt.y });
  for (let i = 0; i < n; i++) { wc.sendInputEvent({ type: "mouseWheel", x: pt.x, y: pt.y, deltaX: 0, deltaY: sign * 500, canScroll: true }); await sleep(40); }
  await sleep(350);
}
async function wheelUp() {
  const a0 = await run("__mc.anchor()"); if (a0 == null) return false;
  await wheel(wheelSign, 3);
  const a1 = await run("__mc.anchorNow()"); if (a1 == null) return true; // the page re-rendered = content changed
  if (a1 - a0 > 2) return true;                                           // content moved down = we went up
  if (a1 - a0 < -2) { wheelSign = -wheelSign; await wheel(wheelSign, 3); return true; } // went the wrong way: flip and undo
  await wheel(-wheelSign, 3);                                              // no movement: maybe the sign is wrong, or we're at the top
  const a2 = await run("__mc.anchorNow()");
  if (a2 != null && a2 - a1 > 2) { wheelSign = -wheelSign; return true; }
  if (a2 != null && a2 - a1 < -2) await wheel(wheelSign, 3);               // that went down: put it back, we're at the top
  return false;
}

// Removes MY reactions in whichever chat is currently open. Starts at the newest message and scrolls UP, removing as it goes
// (older messages load while it climbs), so it doesn't depend on loading the whole chat first.
async function removeReactionsInOpenChat(label, o, c) {
  const st = c.st; let found = 0, notMine = 0, steps = 0, idleTop = 0; const s0 = st.scanned;
  const rows = await run("__mc.waitMessages()");
  if (!rows) { c.emit("log", { text: `${label}: couldn't find the message list. Page diagnostics: ${JSON.stringify(await run("__mc.msgDiag()"))}` }); return false; }
  await run("__mc.toBottom()"); await sleep(500);
  c.emit("log", { text: `${label}: starting at the newest message, scrolling up and removing your reactions as it goes` });
  c.emit("log", { text: `reaction diagnostics: ${JSON.stringify(await run("__mc.reactionDiag()"))}` });
  while (!c.stopped() && st.fails < 5) {
    const m = await run("__mc.nextReaction()");
    if (m.scroll) { // nothing unprocessed on screen: go up
      const s = await run("__mc.scrollUp()");
      let moved = s.moved;
      if (!moved) { moved = await wheelUp(); if (moved && steps % 10 === 0) c.emit("log", { text: `${label}: scrolling with the mouse wheel` }); }
      if (moved) { idleTop = 0; if (++steps % 8 === 0) c.emit("log", { text: `${label}: scrolling up (position ${s.top} of ${s.h}), ${st.scanned} reactions checked so far` }); await sleep(250); continue; }
      if (++idleTop >= 8) { c.emit("log", { text: `${label}: reached the top of the chat (${JSON.stringify({ top: s.top, h: s.h, scrollers: s.n })})` }); break; }
      await sleep(1200); continue; // at the top: give older messages a moment to load
    }
    idleTop = 0;
    if (m.skip) continue;
    st.scanned++;
    c.emit("scan", { text: `${label}: reaction ${preview(m.preview)}` });
    await trustedClick(m.pt); // open the reaction popup
    let chk = await run("__mc.checkReaction()");
    if (!chk.mine && /nothing opened/.test(chk.seen || "")) { await run("__mc.softBadge()"); chk = await run("__mc.checkReaction()"); } // real click did nothing: scripted click
    if (!chk.mine) { if (notMine++ < 3) c.emit("log", { text: `(not yours / no remove option; the popup showed: ${chk.seen || "?"})` }); c.emit("stats", st); continue; }
    found++;
    if (o.dryRun) { await run("__mc.skipReaction()"); st.deleted++; c.emit("stats", st); continue; }
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) { // real click on the text, then on its row, then a scripted click
      const p = attempt < 2 ? await run(`__mc.removePoint(${attempt})`) : true;
      if (!p) break;
      if (attempt < 2) await trustedClick(p); else await run("__mc.softRemove()");
      ok = await run("__mc.reactionRemoved()");
    }
    if (ok) { st.deleted++; st.fails = 0; c.emit("del", { text: `${label}: ${preview(m.preview)} reaction` }); }
    else {
      await run("__mc.skipReaction()"); await dismissErrors(c);
      const rq = await run("__mc.requeueReaction()");
      if (!rq) st.fails++;
      c.emit("log", { text: `failed to remove reaction (still-there)${rq ? ", retrying once" : ""}` });
    }
    c.emit("stats", st);
    await sleep(rand(350, 800));
  }
  c.emit("log", { text: `${label}: checked ${st.scanned - s0} reactions, ${o.dryRun ? "found" : "processed"} ${found} of yours` });
  return true;
}

// ---- Account activity: open the "Your activity" section -> Select -> bottom-bar action -> confirm ----
// urls = direct pages to try first, paths = menu labels to click from /your_activity/ if the direct pages don't work.
const ACT = {
  likes:    { name: "Likes (unlike everything)",      urls: ["/your_activity/interactions/likes"],    paths: [["Interactions", "Likes"]],    action: "^unlike$" },
  comments: { name: "Comments (delete all mine)",     urls: ["/your_activity/interactions/comments"], paths: [["Interactions", "Comments"]], action: "^delete$" },
  reposts:  { name: "Reposts (undo all)",             urls: ["/your_activity/interactions/reposts"],  paths: [["Interactions", "Reposts"], ["Reposts"]], action: "^(unrepost|undo repost|remove|delete|undo)$" },
  storyreplies: { name: "Story replies (delete all)", urls: ["/your_activity/interactions/story_replies"], paths: [["Interactions", "Story replies"], ["Story replies"]], action: "^(delete|remove|unsend)$" },
  reviews:  { name: "Reviews (delete all)",           urls: ["/your_activity/interactions/reviews"],  paths: [["Interactions", "Reviews"], ["Reviews"]], action: "^(delete|remove)$" },
  posts:    { name: "Posts (delete all)",             urls: ["/your_activity/photos_and_videos/posts", "/your_activity/content/posts"],     paths: [["Photos and videos", "Posts"], ["Content you shared", "Posts"], ["Posts"]], action: "^delete$" },
  stories:  { name: "Stories (delete all)",           urls: ["/your_activity/photos_and_videos/stories", "/your_activity/content/stories"], paths: [["Photos and videos", "Stories"], ["Content you shared", "Stories"], ["Stories"]], action: "^delete$" },
  unfollow: { name: "Unfollow everyone I follow", urls: [], paths: [], action: "", special: "following" },
  removefollowers: { name: "Remove all my followers", urls: [], paths: [], action: "", special: "followers" },
  notes:    { name: "Status / Note (delete my note)", urls: [], paths: [], action: "", special: "note" },
};
const J = (x) => JSON.stringify(x);
async function openActivity(cfg, c) { // returns true once the right page with a "Select" button is open
  const say2 = (t) => c.emit("log", { text: `${cfg.name}: ${t}` });
  // 1) the way a person gets there: Home -> More -> Your activity -> section. Every label must be found, so we never act on the wrong page.
  for (const path of cfg.paths) {
    await openPage(IG + "/");
    const y = await run("__mc.openYourActivity()");
    say2(`More > Your activity: ${y.ok ? "opened " + J(y.snap) : "FAILED at " + y.step + " " + J(y.snap)}`);
    if (!y.ok) break; // not logged in / different layout: use the direct pages below
    const r = await run(`__mc.navPath(${J(path)})`);
    if (!r.ok) { say2(`menu item "${r.missing}" not found. Buttons on page: ${(r.labels || []).join(" | ")}`); continue; }
    if (await run("__mc.hasSelect(8000)")) { say2(`page ready (${path.join(" > ")})`); return true; }
    say2(`opened ${path.join(" > ")} but no Select button: ${J(await run("__mc.snapshot()"))}`);
  }
  // 2) direct addresses, only as a fallback
  for (const u of cfg.urls) {
    say2(`opening ${u} directly`);
    await openPage(IG + u);
    if (await run("__mc.hasSelect(8000)")) { say2("page ready"); return true; }
    say2(`no Select button there: ${J(await run("__mc.snapshot()"))}`);
  }
  return false;
}
async function actRound(cfg, dry, c) {
  const p = await run(`__mc.actPrep(${!!dry})`);
  if (!p.selected || dry) return p;
  const n = p.selected;
  c.emit("log", { text: `${cfg.name}: ${n} selected` });
  const a = await run(`__mc.actionPoint(${J(cfg.action)})`);
  if (!a.ok) { await run("__mc.actCancel()"); return { selected: n, ok: false, reason: "no-action-button", snap: a.snap }; }
  await trustedClick(a.pt);
  let cf = await run("__mc.confirmPoint(3500)");
  if (!cf.dialog) { await run("__mc.softAct()"); cf = await run("__mc.confirmPoint(3000)"); } // first click didn't open anything: try once more
  if (cf.dialog) {
    if (!cf.pt) { await run("__mc.actCancel()"); return { selected: n, ok: false, reason: "no-confirm-button " + J(cf.buttons), snap: cf.snap }; }
    c.emit("log", { text: `${cfg.name}: confirming with "${cf.label}"` });
    await trustedClick(cf.pt);
    if (!(await run("__mc.dialogGone(2500)"))) { c.emit("log", { text: `${cfg.name}: confirm click didn't register, clicking it again` }); await run("__mc.softConfirm()"); }
  }
  const f = await run("__mc.actFinish()");
  return Object.assign({ selected: n }, f);
}
// Navigate to the user's profile, wait for the user to open the requested list manually,
// then retain the original automatic row-by-row unfollow / remove workflow.
async function cleanFollow(cfg, o, c) {
  const st = c.st, kind = cfg.special, say2 = (text) => c.emit("log", { text: `${cfg.name}: ${text}` });
  if (o.olderDays > 0 || o.keyword) say2("Note: the keyword / 'older than' filters aren't used here.");
  await openPage(IG + "/");
  const g = await run("__mc.goProfile()");
  let u = g && g.ok ? g.user : null;
  if (g && g.ok) say2(`opened your profile (${g.path})`);
  else {
    if (!u) { await openPage(IG + "/accounts/edit/"); u = await run("__mc.usernameFromEdit()"); }
    if (!u) u = await run("__mc.usernameFromApi()");
    if (u) {
      say2(`found your username: @${u}. Opening your profile`);
      await openPage(`${IG}/${u}/`);
    }
  }
  const path = await run("location.pathname");
  if (!u && !(g && g.ok) && !/^\/[A-Za-z0-9._]+\/?$/.test(path || "")) {
    say2("couldn't open your profile automatically. Please open your Instagram profile manually.");
    c.emit("manual", { text: "OPEN YOUR INSTAGRAM PROFILE" });
    return;
  }

  const LIST = kind === "following" ? "Following" : "Followers", ACTION = kind === "following" ? "unfollowing" : "removing";
  c.emit("manual", { text: `OPEN ${LIST.toUpperCase()} LIST` });
  say2(`profile ready. Open the ${LIST} list in the Instagram window; ${ACTION} starts by itself the moment it opens.`);
  if (o.dryRun) say2("DRY RUN is ticked: it will only count rows and will NOT change anything. Press Stop, untick 'Dry run', and start again to do it for real.");
  // Wait (as long as it takes) for the matching list. Never clicks the Followers / Following count itself.
  const runSafe = async (code) => { try { return await run(code); } catch { await inject(); return await run(code); } };
  let warned = null;
  while (!c.stopped()) {
    const r = await runSafe(`__mc.listReady(${J(kind)}, 900)`);
    if (r && (!r.list || r.list === kind)) break;
    if (r && r.list !== warned) { warned = r.list; say2(`the ${r.list === "followers" ? "Followers" : "Following"} list is open, but this task needs the ${LIST} list. Close it and open ${LIST}.`); }
    await sleep(250);
  }
  if (c.stopped()) { say2("stopped while waiting for the list to open"); return; }
  c.emit("manual", { text: "" });
  say2(`${LIST} list detected. ${ACTION[0].toUpperCase() + ACTION.slice(1)} automatically.`);
  await sleep(1200); // let the first rows finish rendering

  while (!c.stopped() && st.fails < 5) {
    const m = await run(`__mc.nextFollow(${J(kind)})`);
    if (m.done) { say2(`finished (${m.why})`); break; }
    st.scanned++; c.emit("scan", { text: `${cfg.name}: ${m.name}` });
    if (o.dryRun) { st.deleted++; c.emit("stats", st); continue; }
    const prev = await run("__mc.dialogCount()");
    await trustedClick(m.pt);
    let cf = await run(`__mc.followConfirm(${prev}, ${J(kind)})`);
    if (!cf.dialog) { await run("__mc.softFollowBtn()"); cf = await run(`__mc.followConfirm(${prev}, ${J(kind)})`); }
    if (cf.dialog && cf.pt) {
      await trustedClick(cf.pt);
      if (!(await run(`__mc.dialogsAtMost(${prev}, 2500)`))) await run("__mc.softConfirm()");
    } else if (cf.dialog) say2(`confirm popup had no matching button: ${J(cf.buttons)}`);
    if (await run(`__mc.followDone(${J(kind)})`)) { st.deleted++; st.fails = 0; c.emit("del", { text: `${cfg.name}: ${m.name}` }); }
    else { await dismissErrors(c); st.fails++; say2(`failed on ${m.name}`); await run("__mc.dialogsAtMost(" + prev + ", 1500)"); }
    c.emit("stats", st);
    await sleep(rand(1500, 3200)); // keep the existing rate-limited pacing
  }
}

async function cleanActivity(t, o, c) {
  const cfg = ACT[t.id], st = c.st;
  if (!cfg) { c.emit("log", { text: `Unknown activity item: ${t.id}` }); return; }
  c.emit("target", { text: cfg.name });
  if (o.olderDays > 0 || o.keyword) c.emit("log", { text: "Note: the keyword / 'older than' filters aren't used for account activity." });
  if (cfg.special === "following" || cfg.special === "followers") return cleanFollow(cfg, o, c);
  if (cfg.special === "note") {
    await openPage(IG + "/direct/inbox/");
    const r = await run(`__mc.deleteNote(${!!o.dryRun})`);
    if (!r.found) { c.emit("log", { text: `${cfg.name}: no note of yours found. Buttons on page: ${(r.labels || []).join(" | ")}` }); return; }
    st.scanned++;
    if (o.dryRun) { st.deleted++; c.emit("log", { text: `${cfg.name}: you have a note (dry run, not deleted)` }); }
    else if (r.ok) { st.deleted++; c.emit("del", { text: `${cfg.name}: note deleted` }); }
    else { await dismissErrors(c); st.fails++; c.emit("log", { text: `${cfg.name}: failed (${r.reason}). Buttons on page: ${(r.labels || []).join(" | ")}` }); }
    c.emit("stats", st); return;
  }
  if (!(await openActivity(cfg, c))) { st.fails++; c.emit("log", { text: `${cfg.name}: couldn't open this section. Please send me the log lines above.` }); return; }
  let reopens = 0;
  for (let round = 1; round <= 500 && !c.stopped() && st.fails < 5; round++) {
    await inject(); await dismissErrors(c);
    const r = await actRound(cfg, !!o.dryRun, c);
    if (!r.selected) {
      // The page often hasn't refreshed after a batch: reload it and look again before deciding we're finished.
      if (round > 1 && reopens < 2) { reopens++; c.emit("log", { text: `${cfg.name}: list looks empty, reloading it to check for more (${reopens}/2)` }); if (await openActivity(cfg, c)) continue; }
      c.emit("log", { text: `${cfg.name}: ${round === 1 ? "nothing found" : "done, nothing left"}${r.reason ? " (" + r.reason + ")" : ""}${r.snap ? " " + J(r.snap) : ""}` }); break;
    }
    st.scanned += r.selected; c.emit("scan", { text: `${cfg.name}: selected ${r.selected}` });
    if (o.dryRun) { st.deleted += r.selected; c.emit("stats", st); c.emit("log", { text: `${cfg.name}: ${r.selected} loaded items would be processed (a dry run only checks the first batch)` }); break; }
    if (r.ok) { st.deleted += r.selected; st.fails = 0; reopens = 0; c.emit("del", { text: `${cfg.name}: ${r.selected} items` }); }
    else { st.fails++; c.emit("log", { text: `${cfg.name}: failed (${r.reason}) ${r.snap ? J(r.snap) : ""}` }); if (await openActivity(cfg, c)) continue; } // reload and try the next batch fresh
    c.emit("stats", st);
    await sleep(rand(500, 900));
  }
}

async function clean(t, o, c) {
  startWatch(c);
  try { return await cleanInner(t, o, c); } finally { stopWatch(); }
}
async function cleanInner(t, o, c) {
  if (t.kind === "activity") return cleanActivity(t, o, c);
  const work = o.mode === "reactions" ? removeReactionsInOpenChat : unsendInOpenChat;
  if (o.mode === "reactions" && (o.keyword || o.olderDays > 0)) c.emit("log", { text: "Note: the keyword / 'older than' filters aren't used for Instagram reactions." });
  if (o.olderDays > 0) c.emit("log", { text: "Note: the 'older than' filter isn't supported for Instagram; ignoring it." });
  if (t.id === "all") {
    const done = [];
    while (!c.stopped() && c.st.fails < 5) {
      await openPage(IG + "/direct/inbox/");
      const nx = await run(`__mc.openNext(${JSON.stringify(done)})`);
      if (!nx) { c.emit("log", { text: `Reached the end of the inbox (${done.length} conversations).` }); break; }
      done.push(nx.key); c.emit("target", { text: nx.name });
      await work(nx.name, o, c);
    }
    return;
  }
  c.emit("target", { text: t.name });
  if (String(t.id).startsWith("n:")) {
    await openPage(IG + "/direct/inbox/");
    if (!(await run(`__mc.openChat(${JSON.stringify(t.name)})`))) { c.st.fails++; c.emit("log", { text: `${t.name}: couldn't open this chat` }); return; }
  } else await openPage(`${IG}/direct/t/${t.id}/`);
  await work(t.name, o, c);
}
async function logout() {
  try { await ses.clearStorageData(); await ses.clearCache(); } catch {}
  connected = false;
}
module.exports = { id, setup, connect, isConnected: () => connected, listTargets, clean, logout };
