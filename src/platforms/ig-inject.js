// Runs INSIDE the Instagram page. Based on the hover -> "More" -> "Unsend" -> confirm flow
// of the script the user supplied, but using aria-labels / text instead of hashed CSS classes.
(() => {
  if (window.__mc) return;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CONV = "x78zum5 xdt5ytf x1iyjqo2 xs83m0k x1xzczws x6ikm8r x1odjw0f x1n2onr6 xh8yej3 x16o0dkt";
  const OPTS = "x6s0dn4 x78zum5 xdt5ytf xl56j7k";
  const MOREUI = "html-div xdj266r x14z9mp xat24cr x1lziwak xexx8yu xyri2b x18d9i69 x1c1uobl x9f619 xjbqb8w x78zum5 x15mokao x1ga7v0g x16uus16 xbiv7yw x1uhb9sk x1plvlek xryxfnj x1iyjqo2 x2lwn1j xeuugli xdt5ytf xqjyukv x1cy8zhl x1oa3qoh x1nhvcw1";
  const UNSENDLBL = "x1lliihq x193iq5w x6ikm8r x10wlt62 xlyipyv xuxw1ft";
  const CONFIRM = "xjbqb8w x1qhh985 x10w94by x14e42zd x1yvgwvq x13fuv20 x178xt8z x1ypdohk xvs91rp x1evy7pa xdj266r x14z9mp xat24cr x1lziwak x1wxaq2x x1iorvi4 xf159sx xjkvuk6 xmzvs34 x2b8uid x87ps6o xxymvpz xh8yej3 x52vrxo x4gyw5p xkmlbd1 x1xlr1w8";
  const convEl = () => { const l = document.getElementsByClassName(CONV); return l[1] || l[0] || null; };
  const composer = () => document.querySelector('[role="textbox"][contenteditable="true"], [contenteditable="true"][aria-label*="essage"], div[contenteditable="true"], textarea');
  let paneCache = null;
  const msgScroller = () => { // the scrollable area next to the message composer (not the inbox list)
    if (paneCache && paneCache.isConnected) return paneCache;
    const c = composer(); let e = c && c.parentElement;
    while (e && e !== document.body) {
      const cands = [...e.querySelectorAll("div")].filter((d) => !d.contains(c) && d.scrollHeight > d.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(d).overflowY));
      if (cands.length) { cands.sort((x, y) => y.scrollHeight - x.scrollHeight); return (paneCache = cands[0]); }
      e = e.parentElement;
    }
    return null;
  };
  const textEls = () => {
    const sc = msgScroller(); if (!sc) return [];
    let t = [...sc.querySelectorAll('div[dir="auto"], span[dir="auto"]')].filter((e) => (e.innerText || "").trim() && !e.closest('[contenteditable="true"]'));
    return t.filter((e) => !t.some((o) => o !== e && e.contains(o))); // innermost only
  };
  // ORIGINAL row detection (unchanged from V1): text bubbles. Used for waiting/loading so chat scanning behaves exactly as before.
  const baseRows = () => {
    const cv = convEl();
    let r = [...(cv || document).querySelectorAll('[data-release-focus-from="CLICK"]')];
    if (!r.length) r = textEls();
    return r;
  };
  // ADDITIVE: shared reels/posts/videos (cards, not text). Only looks inside the open message pane, and can never throw.
  const mediaEls = () => {
    try {
      const sc = msgScroller(); if (!sc) return [];
      const c = composer();
      let m = [...sc.querySelectorAll('a[href*="/reel"], a[href*="/p/"], a[href*="/tv/"], video')].filter((e) => {
        if (c && c.contains(e)) return false;
        const b = e.getBoundingClientRect();
        return b.width >= 80 && b.height >= 80;
      });
      return m.filter((e) => !m.some((o) => o !== e && o.contains(e)));
    } catch (e) { return []; }
  };
  const rowsAll = () => {
    const base = baseRows();
    try {
      const media = mediaEls().filter((e) => !base.some((b) => b.hasAttribute("data-release-focus-from") && b.contains(e)));
      if (!media.length) return base;
      const rows = base.filter((b) => !media.some((m) => m.contains(b))).concat(media);
      rows.sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      return rows;
    } catch (e) { return base; }
  };
  const scroller = () => {
    const cv = convEl(); if (cv && cv.scrollHeight > cv.clientHeight) return cv;
    const m = msgScroller(); if (m) return m;
    const r = rowsAll()[0] || reactionEls()[0]; let e = r && r.parentElement;
    while (e && e !== document.body) { if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; e = e.parentElement; }
    return null;
  };
  // The scrollable box in the SAME COLUMN as the message composer that holds the most message text (works without class names).
  let colCache = null;
  const paneByColumn = () => {
    if (colCache && colCache.isConnected && colCache.scrollHeight > colCache.clientHeight + 5) return colCache;
    const c = composer(), cr = c ? c.getBoundingClientRect() : null, cx = cr ? cr.left + cr.width / 2 : innerWidth * 0.6;
    let best = null, bestScore = -1;
    for (const d of document.querySelectorAll("div")) {
      if (c && d.contains(c)) continue;
      if (!(d.scrollHeight > d.clientHeight + 20) || !/auto|scroll/.test(getComputedStyle(d).overflowY)) continue;
      const b = d.getBoundingClientRect(); if (b.width < 200 || b.height < 150 || cx < b.left || cx > b.right) continue;
      const score = d.querySelectorAll('div[dir="auto"],span[dir="auto"],[data-release-focus-from="CLICK"]').length;
      if (score > bestScore) { best = d; bestScore = score; }
    }
    return (colCache = best);
  };
  // Every element that might be the thing that scrolls the chat, most likely first.
  const scrollCandidates = () => {
    const out = []; const add = (e) => { if (e && e.isConnected && e.scrollHeight > e.clientHeight + 5 && !out.includes(e)) out.push(e); };
    add(convEl()); add(paneByColumn()); add(msgScroller());
    const r = rowsAll()[0] || reactionEls()[0]; let e = r && r.parentElement;
    while (e && e !== document.body) { if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) add(e); e = e.parentElement; }
    return out;
  };
  // One step up the chat. If scrolling didn't move anything, force the oldest visible item into view instead.
  const stepUp = async (sc) => {
    const b = sc.scrollTop;
    sc.scrollBy(0, -Math.max(300, Math.floor(sc.clientHeight * 0.8))); await sleep(350);
    if (Math.abs(sc.scrollTop - b) > 1) return true;
    const first = (rowsAll()[0]) || (reactionEls()[0]); if (first) { first.scrollIntoView({ block: "start" }); await sleep(350); }
    return Math.abs(sc.scrollTop - b) > 1;
  };
  const fire = (el, types) => types.forEach((t) => el.dispatchEvent(new MouseEvent(t, { view: window, bubbles: true, cancelable: true })));
  const findText = (root, txt) => [...root.querySelectorAll('span,div,button,[role="menuitem"],[role="button"]')].find((e) => e.children.length === 0 && (e.textContent || "").trim().toLowerCase() === txt);
  const closeMenus = async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(120); };
  let cur = null, lastHover = null;

  const STATUS = /^(active(\s+(now|today|yesterday|\d+\s*\w+\s*ago))?|online|offline|typing(\.\.\.|…)?|unread|\d+\s*(new\s+)?messages?|[·•])$/i;
  const rowName = (r) => {
    const lines = (r.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const n = lines.find((l) => !STATUS.test(l));
    if (n) return n;
    const im = [...r.querySelectorAll("img[alt]")].map((i) => i.getAttribute("alt") || "").find((a) => /profile picture/i.test(a));
    return im ? im.replace(/['’]s profile picture$/i, "").trim() : "";
  };
  const vScroller = (el) => { let e = el && el.parentElement; while (e && e !== document.body) { if (e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; e = e.parentElement; } return null; };
  const chatRows = () => {
    let root = document.querySelector('[data-pagelet*="InboxThreadList"]') || document.querySelector('[aria-label="Chats"]');
    let rows = [...document.querySelectorAll('a[href^="/direct/t/"]')];
    if (!rows.length && root) rows = [...root.querySelectorAll('[role="button"],[role="listitem"],[role="link"]')];
    rows = rows.filter((r) => (r.innerText || "").trim());
    rows = rows.filter((r) => !rows.some((o) => o !== r && r.contains(o))); // innermost only
    const rw = (root || document.body).getBoundingClientRect().width;
    // Notes/songs bubbles are small; conversation rows span the list width and have 2+ lines (name + last message)
    return rows.filter((r) => { const b = r.getBoundingClientRect(); return b.width >= rw * 0.6 && b.height >= 40 && (r.innerText || "").trim().split("\n").filter(Boolean).length >= 2; });
  };

  // ---- account activity (Your activity -> Select -> action -> confirm) ----
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const CLICKY = 'button,[role="button"],a,[role="link"],[role="menuitem"],[role="tab"],[role="radio"],[role="option"]';
  const findAct = (re, root, last) => {
    const leaves = [...(root || document).querySelectorAll("*")].filter((e) => e.children.length === 0 && vis(e) && re.test((e.textContent || "").trim()));
    const leaf = last ? leaves[leaves.length - 1] : leaves[0];
    return leaf ? (leaf.closest(CLICKY) || leaf) : null;
  };
  const labelsNow = () => [...new Set([...document.querySelectorAll(CLICKY)].filter(vis).map((e) => (e.innerText || e.getAttribute("aria-label") || "").trim().split("\n")[0]).filter(Boolean))].slice(0, 40);
  const tileEls = () => {
    const t = [...document.querySelectorAll("img,video")].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 60 && b.height >= 60 && !e.closest('nav,[role="navigation"],[role="dialog"],header,[role="banner"]');
    }).map((e) => e.closest('[role="button"],a,[tabindex="0"]') || e.parentElement);
    return [...new Set(t)].filter(Boolean);
  };
  const tileKey = () => { const t = tileEls()[0]; if (!t) return ""; const im = t.querySelector("img,video"); return (im && (im.currentSrc || im.src)) || (t.innerText || "").slice(0, 40); };
  const waitFor = async (fn, ms) => { for (let i = 0; i < ms / 100; i++) { const r = fn(); if (r) return r; await sleep(100); } return null; };
  // ---- reactions ----
  const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\s\d]{1,16}$/u;
  const emojiOf = (e) => ((e.tagName === "IMG" ? e.getAttribute("alt") : e.innerText || e.getAttribute("aria-label")) || "").trim();
  const emojiLike = (e) => { const tx = emojiOf(e); return !!tx && tx.length <= 16 && /\p{Extended_Pictographic}/u.test(tx) && EMOJI_ONLY.test(tx); };
  const reactionEls = () => { // small emoji badges under message bubbles
    try {
      const sc = paneByColumn() || msgScroller(); if (!sc) return [];
      const c = composer();
      let t = [...sc.querySelectorAll("div,span,img[alt],[aria-label]")].filter((e) => {
        if (e.tagName !== "IMG" && e.children.length > 3) return false;
        if (!emojiLike(e)) return false;
        if (c && c.contains(e)) return false;
        if (e.closest('[role="dialog"],[role="menu"]')) return false;
        const b = e.getBoundingClientRect(); return b.width > 0 && b.width <= 90 && b.height <= 60;
      });
      return t.filter((e) => !t.some((o) => o !== e && e.contains(o))); // innermost only
    } catch (e) { return []; }
  };
  const removeLabel = (root) => [...(root || document).querySelectorAll("*")].find((e) => e.children.length === 0 && /^(click|tap|select|press)\s+(here\s+)?to\s+remove$/i.test((e.textContent || "").trim()));
  const closeDialog = async () => {
    for (let i = 0; i < 3; i++) {
      const d = document.querySelector('[role="dialog"]'); if (!d && !removeLabel()) break;
      const x = document.querySelector('[role="dialog"] [aria-label="Close"], [role="dialog"] [aria-label="close"]');
      if (x) (x.closest('[role="button"],button') || x).click(); else await closeMenus();
      await sleep(150);
    }
  };
  let curR = null, actEl = null, actBefore = "", curRow = null, curBadge = null, confirmEl = null, anchorEl = null, followEl = null;
  // Where to aim a REAL mouse click (the app sends it with Electron, which Instagram can't ignore like it can a scripted click).
  const pointOf = (el) => {
    if (!el) return null;
    let b = el.getBoundingClientRect();
    if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) { try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {} b = el.getBoundingClientRect(); }
    if (!b.width || !b.height) return null;
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  };
  const aim = async (el) => { try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {} await sleep(150); return pointOf(el); };
  const clickable = (el) => { let e = el; for (let i = 0; i < 8 && e && e !== document.body; i++) { if ((e.matches && e.matches(CLICKY + ',[tabindex=\"0\"]')) || getComputedStyle(e).cursor === "pointer") return e; e = e.parentElement; } return el; };
  const softClick = (el) => { // fallback only: full pointer sequence from script
    if (!el) return; const b = el.getBoundingClientRect();
    const o = { view: window, bubbles: true, cancelable: true, composed: true, button: 0, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 };
    ["pointerover", "mouseover", "pointermove", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((t) => {
      const E = t.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
      el.dispatchEvent(new E(t, Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, o)));
    });
  };
  const dlgNow = () => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis).pop() || null;

  window.__mc = {
    async waitMessages() { for (let i = 0; i < 40 && !baseRows().length; i++) { await window.__mc.dismiss(); await sleep(500); } return baseRows().length; },
    msgDiag() {
      const q = (x) => document.querySelectorAll(x).length, sc = msgScroller();
      const labels = [...new Set([...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")))].slice(0, 25);
      return { url: location.href, composer: !!composer(), scroller: !!sc, scrollerSize: sc ? [sc.clientHeight, sc.scrollHeight] : null, textEls: textEls().length,
        focusFromClick: q('[data-release-focus-from="CLICK"]'), mediaCards: mediaEls().length, reelLinks: q('a[href*="/reel"]'), videos: q('video'), width: innerWidth, labels };
    },
    async loadAll() { // scroll to the top until older messages stop arriving
      const s = scroller(); if (!s) return { ok: false, rows: rowsAll().length };
      let same = 0, lastH = -1;
      for (let i = 0; i < 700 && same < 12; i++) {
        s.scrollTo(0, 0); await sleep(450);
        const h = s.scrollHeight; same = h === lastH ? same + 1 : 0; lastH = h;
      }
      s.scrollTo(0, s.scrollHeight); await sleep(400);
      return { ok: true, rows: rowsAll().length };
    },
    // Picks the lowest unprocessed message, opens its menu, reports whether it can be unsent (= it's mine).
    async next() {
      cur = null;
      let idle = 0, stuck = 0;
      for (let guard = 0; guard < 3000; guard++) {
        const rows = rowsAll().filter((r) => !r.dataset.mc);
        if (!rows.length) {
          const s = scroller();
          if (!s) return { done: true };
          if (s.scrollTop <= 1) { idle++; if (idle >= 5) return { done: true }; s.scrollTo(0, 0); await sleep(1500); continue; } // top reached: wait for older messages
          idle = 0; if (await stepUp(s)) stuck = 0; else if (++stuck >= 6) return { done: true }; continue;
        }
        idle = 0;
        const row = rows[rows.length - 1]; row.dataset.mc = "1"; curRow = row;
        const isReel = !!(row.matches && row.matches('a[href*="/reel"]') || row.querySelector && row.querySelector('a[href*="/reel"]'));
        const preview = (row.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80) || (isReel ? "[reel]" : "[media/other]");
        row.scrollIntoView({ block: "center" }); await sleep(80);
        const textStyle = !row.hasAttribute("data-release-focus-from");
        if (textStyle) { // my messages sit on the right half of the pane
          const sc0 = msgScroller(), rb = row.getBoundingClientRect(), sb = sc0 ? sc0.getBoundingClientRect() : null;
          if (sb && rb.left + rb.width / 2 < sb.left + sb.width * 0.58) return { preview, mine: false };
        }
        if (lastHover && lastHover[0].isConnected) lastHover.forEach((e) => fire(e, ["mouseout", "mouseleave", "pointerout"]));
        const chain = []; { let a2 = row; for (let i = 0; i < 14 && a2 && a2 !== document.body; i++) { chain.push(a2); a2 = a2.parentElement; } }
        lastHover = chain;
        chain.forEach((e) => fire(e, ["pointerover", "mouseover", "mouseenter", "mousemove"]));
        const findMore = () => {
          const exact = [...row.getElementsByClassName(OPTS)].pop();
          let m = exact && exact.querySelector("title") && /more/i.test(exact.querySelector("title").textContent) ? exact : null;
          for (let i = 0; i < chain.length && !m; i++) m = [...chain[i].querySelectorAll('[aria-label],svg title')].find((e) => /\bmore\b/i.test(e.getAttribute("aria-label") || e.textContent || ""));
          return m;
        };
        let more = null;
        for (let t = 0; t < 14 && !more; t++) { await sleep(t ? 100 : 250); more = findMore(); }
        const btn = more && (more.closest('[role="button"],button') || more);
        if (!btn) return { preview, mine: false, reason: "no-more-button" };
        btn.click();
        const findUnsend = () => {
          const mu = document.getElementsByClassName(MOREUI), last = mu[mu.length - 1];
          if (last) { const sp = last.querySelector("span"); const lb = sp && sp.getElementsByClassName(UNSENDLBL)[0]; if (lb && lb.innerText === "Unsend") return last; }
          return findText(document, "unsend");
        };
        let unsend = null;
        for (let t = 0; t < 12 && !unsend; t++) { await sleep(t ? 100 : 250); unsend = findUnsend(); if (!unsend && t >= 3 && document.querySelector('[role="menuitem"],[role="menu"]')) break; } // menu is open but has no Unsend = not mine
        if (!unsend) { await closeMenus(); return { preview, mine: false }; }
        cur = unsend; return { preview, mine: true };
      }
      return { done: true };
    },
    // Reactions step 1: picks the lowest unprocessed reaction badge and returns WHERE to click it (the app clicks for real).
    async nextReaction() {
      curR = null;
      const els = reactionEls().filter((e) => !e.dataset.mcr);
      if (!els.length) return { scroll: true, left: reactionEls().length };
      els.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const el = els[els.length - 1]; el.dataset.mcr = "1"; curBadge = el;
      const emoji = emojiOf(el);
      const pt = await aim(el);
      if (!pt) return { scroll: false, skip: true, preview: emoji };
      return { preview: emoji, pt };
    },
    // Scroll the chat up one screen, trying every element that could be the scroller. Reports whether anything moved.
    async scrollUp() {
      const cands = scrollCandidates();
      for (const sc of cands) {
        const b = sc.scrollTop;
        sc.scrollBy(0, -Math.max(300, Math.floor(sc.clientHeight * 0.8))); await sleep(250);
        if (Math.abs(sc.scrollTop - b) > 1) { await sleep(150); return { moved: true, top: Math.round(sc.scrollTop), h: sc.scrollHeight }; }
      }
      const sc = cands[0];
      return { moved: false, top: sc ? Math.round(sc.scrollTop) : null, h: sc ? sc.scrollHeight : null, n: cands.length };
    },
    toBottom() { scrollCandidates().forEach((sc) => sc.scrollTo(0, sc.scrollHeight)); return scrollCandidates().length; },
    // For real mouse-wheel scrolling (fallback): a point over the chat, and a message to watch to see which way the content moved.
    panePoint() { const sc = paneByColumn() || msgScroller() || scroller(); if (!sc) return null; const b = sc.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height * 0.45) }; },
    anchor() {
      const sc = paneByColumn() || msgScroller(), b = sc ? sc.getBoundingClientRect() : null;
      const pool = rowsAll().concat(textEls(), reactionEls());
      anchorEl = pool.find((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && (!b || (r.top > b.top + 20 && r.bottom < b.bottom - 20)); }) || null;
      return anchorEl ? anchorEl.getBoundingClientRect().top : null;
    },
    anchorNow() { return anchorEl && anchorEl.isConnected ? anchorEl.getBoundingClientRect().top : null; },
    softBadge() { if (curBadge && curBadge.isConnected) softClick(curBadge.closest('[role="button"],button') || curBadge); },
    softConfirm() { if (confirmEl && confirmEl.isConnected) { softClick(confirmEl); try { confirmEl.click(); } catch (e) {} } },
    // ---- followers / following lists ----
    // Click "Profile" in the sidebar like a person would, then report the username from the address bar.
    async goProfile() {
      const bad = /^(explore|reels|direct|accounts|stories|p|reel|tv|your_activity)$/i;
      const find = () => {
        const nav = document.querySelector('nav,[role="navigation"]');
        const inNav = nav ? [...nav.querySelectorAll('a[href^="/"]')].filter(vis) : [];
        return inNav.find((a) => /^profile$/i.test(((a.innerText || "") || a.getAttribute("aria-label") || "").trim()))
          || document.querySelector('a[aria-label="Profile"]')
          || (document.querySelector('svg[aria-label="Profile"]') || { closest: () => null }).closest("a")
          || findAct(/^profile$/i)
          || inNav.find((a) => a.querySelector('img[alt*="profile picture" i]'))
          || [...document.querySelectorAll('a[href^="/"]')].filter(vis).find((a) => a.querySelector('img[alt*="profile picture" i]') && a.getBoundingClientRect().left < innerWidth * 0.15 && /^\/[A-Za-z0-9._]+\/?$/.test(a.getAttribute("href") || ""));
      };
      const el = await waitFor(find, 5000);
      if (!el) return { ok: false };
      const link = el.closest ? el.closest("a") : null, href = (link && link.getAttribute("href")) || "";
      el.click();
      const seg = () => { const m = location.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/); return m && !bad.test(m[1]) ? m[1] : null; };
      const user = await waitFor(seg, 8000) || ((href.match(/^\/([A-Za-z0-9._]+)\/?$/) || [])[1]) || null;
      await sleep(800);
      return { ok: true, user, path: location.pathname };
    },
    // Reads your username from the Edit profile page (shown next to "Change photo"), or from your avatar's alt text.
    async usernameFromEdit() {
      const ok = /^[A-Za-z0-9._]{1,30}$/;
      const input = document.querySelector('input[name="username"],input[aria-label="Username"],input[placeholder="Username"]');
      if (input && input.value) return input.value.trim();
      await waitFor(() => findAct(/^change photo$/i) || document.querySelector('img[alt$="profile picture" i]'), 8000);
      for (const im of document.querySelectorAll("img[alt]")) {
        const m = (im.getAttribute("alt") || "").match(/^(.+?)['’]s profile picture$/i);
        if (m && ok.test(m[1].trim())) return m[1].trim();
      }
      const btn = findAct(/^change photo$/i);
      let e = btn;
      for (let i = 0; i < 6 && e && e !== document.body; i++) {
        e = e.parentElement; if (!e) break;
        const lines = (e.innerText || "").split("\n").map((x) => x.trim()).filter((x) => x && !/^change photo$/i.test(x));
        const u = lines.find((l) => ok.test(l)); if (u) return u;
      }
      return null;
    },
    // Last resort: ask Instagram (same page, your own session, read-only) who is logged in.
    async usernameFromApi() {
      try {
        const r = await fetch("/api/v1/accounts/current_user/?edit=true", { credentials: "include", headers: { "X-IG-App-ID": "936619743392459", "X-Requested-With": "XMLHttpRequest" } });
        const j = await r.json(); return (j && j.user && j.user.username) || null;
      } catch (e) { return null; }
    },
    // True once a Followers / Following list is really open: a visible dialog that contains row buttons
    // (Following / Follow / Remove / Requested). Ignores unrelated popups (notifications, cookies, etc.).
    async listReady(kind, ms) {
      const r = await waitFor(() => {
        const d = [...document.querySelectorAll('[role="dialog"]')].filter(vis)[0];
        if (!d) return null;
        const has = [...d.querySelectorAll(CLICKY)].filter(vis).some((b) => /^(following|follow|remove|requested)$/i.test((b.innerText || "").trim().split("\n")[0]));
        if (!has) return null;
        const lines = (d.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6);
        const h = lines.find((l) => /^(followers?|following)$/i.test(l));
        return { list: h ? (/^followers?$/i.test(h) ? "followers" : "following") : null };
      }, ms || 900);
      return r || null;
    },
    async hasListDialog(ms) { return !!(await waitFor(() => [...document.querySelectorAll('[role="dialog"]')].filter(vis)[0], ms || 8000)); },
    async openFollowDialog(kind) { // open the Followers / Following list from the visible profile header
      if (kind !== "followers" && kind !== "following") return false;
      const re = kind === "followers" ? /^followers?$/i : /^following$/i;
      const profileUser = (() => {
        const m = location.pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
        return m && !/^(explore|reels|direct|accounts|stories|p|reel|tv|your_activity)$/i.test(m[1]) ? m[1] : null;
      })();
      const findCount = () => {
        const links = [...document.querySelectorAll('a[href]')].filter(vis).filter((a) => {
          const href = (a.getAttribute("href") || "").replace(/\/$/, "");
          const text = (a.innerText || a.textContent || "").replace(/\s+/g, " ").trim();
          const hrefMatch = profileUser
            ? href.toLowerCase() === (`/${profileUser}/${kind}`).toLowerCase()
            : new RegExp("/" + kind + "$").test(href);
          return hrefMatch && (re.test(text) || new RegExp("\\d[\\d,.]*\\s*" + kind + "\\b", "i").test(text));
        });
        if (links.length) return links[links.length - 1];
        // Instagram sometimes renders the count as a button/span rather than an anchor.
        const header = document.querySelector('main header,[role="main"] header,header');
        return findAct(re, header || document.querySelector('main,[role="main"]') || document, true);
      };
      const el = await waitFor(findCount, 10000);
      if (!el) return false;
      const target = el.closest(CLICKY) || el;
      try { target.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) {}
      await sleep(150);
      target.click();
      // Confirm that Instagram actually opened the list, not merely that a count was clicked.
      if (await window.__mc.hasListDialog(5000)) return true;
      // A second attempt handles occasional missed React clicks on the count label.
      const retry = findCount();
      if (retry && retry.isConnected) {
        fire(retry.closest(CLICKY) || retry, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
        if (await window.__mc.hasListDialog(5000)) return true;
      }
      return false;
    },
    dialogCount() { return [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis).length; },
    async dialogsAtMost(n, ms) { return !!(await waitFor(() => window.__mc.dialogCount() <= n, ms || 3000)); },
    // Next row in the open list that still has an "unfollow" (Following) / "Remove" button; scrolls the list to load more rows.
    async nextFollow(kind) {
      const re = kind === "followers" ? /^remove$/i : /^(following|requested)$/i;
      const d = [...document.querySelectorAll('[role="dialog"]')].filter(vis)[0];
      if (!d) return { done: true, why: "no-list-open" };
      const nameOf = (b) => { let e = b; for (let i = 0; i < 6 && e && e !== d; i++) { e = e.parentElement; const a = e && e.querySelector('a[href^="/"]'); if (a && (a.innerText || "").trim()) return a.innerText.trim().split("\n")[0]; } return "user"; };
      let idle = 0, lastH = -1;
      for (let g = 0; g < 600; g++) {
        const btns = [...d.querySelectorAll(CLICKY)].filter(vis).filter((b) => re.test((b.innerText || "").trim().split("\n")[0]) && !b.dataset.mcf);
        if (btns.length) {
          const b = btns[0]; b.dataset.mcf = "1"; followEl = b;
          const pt = await aim(b); if (!pt) continue;
          return { name: nameOf(b), pt };
        }
        const sc = [...d.querySelectorAll("div")].filter((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)).sort((a, b) => b.clientHeight - a.clientHeight)[0];
        if (!sc) return { done: true, why: "no-scroller" };
        const before = sc.scrollTop;
        sc.scrollTo(0, sc.scrollHeight); await sleep(900);
        const h = sc.scrollHeight; idle = (h === lastH && Math.abs(sc.scrollTop - before) < 2) ? idle + 1 : 0; lastH = h;
        if (idle >= 4) return { done: true, why: "end-of-list" };
      }
      return { done: true, why: "guard" };
    },
    // The confirm popup that appears AFTER clicking a row button (a NEW dialog; never a button in the list itself).
    async followConfirm(prev, kind) {
      const dl = () => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis);
      const re = kind === "followers" ? /^remove/i : /^unfollow/i;
      const d = await waitFor(() => { const x = dl(); return x.length > prev ? x[x.length - 1] : null; }, 3500);
      let b = null;
      if (d) { await sleep(200); b = [...d.querySelectorAll(CLICKY)].filter(vis).filter((x) => re.test((x.innerText || "").trim().split("\n")[0])).pop(); if (!b) return { dialog: true, pt: null, buttons: [...d.querySelectorAll(CLICKY)].filter(vis).map((x) => (x.innerText || "").trim().split("\n")[0]).slice(0, 8) }; }
      else if (kind !== "followers") { const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && vis(e) && /^unfollow$/i.test((e.textContent || "").trim())); const l = leaves.pop(); b = l ? (l.closest(CLICKY) || l) : null; } // not a role=dialog: exact "Unfollow" label
      if (!b) return { dialog: false };
      confirmEl = b; let pt = pointOf(b);
      for (let i = 0; i < 8; i++) { await sleep(120); const p2 = pointOf(b); if (p2 && pt && Math.abs(p2.x - pt.x) < 2 && Math.abs(p2.y - pt.y) < 2) break; pt = p2; }
      return { dialog: true, pt, label: (b.innerText || "").trim().split("\n")[0] };
    },
    softFollowBtn() { if (followEl && followEl.isConnected) softClick(followEl); },
    async followDone(kind) { // did the row's button change (Following -> Follow) or the row disappear?
      const re = kind === "followers" ? /^remove$/i : /^(following|requested)$/i;
      for (let i = 0; i < 50; i++) { await sleep(100); if (!followEl || !followEl.isConnected || !re.test((followEl.innerText || "").trim().split("\n")[0])) return true; }
      return false;
    },
    async dialogGone(ms) { return !!(await waitFor(() => !dlgNow(), ms || 2500)); },
    // Reactions step 2 (after the app clicked the badge): is there a "Click to remove" row = is it mine?
    async checkReaction() {
      const rm = await waitFor(() => removeLabel(), 2500);
      if (!rm) { const d = dlgNow() || document.querySelector('[role="menu"]'); const seen = d ? (d.innerText || "").replace(/\s+/g, " ").slice(0, 140) : "(nothing opened)"; await closeDialog(); return { mine: false, seen }; }
      curR = rm; return { mine: true };
    },
    reactionDiag() { // what emoji-looking elements exist, ignoring the size/place filters
      const sc = paneByColumn() || msgScroller(); if (!sc) return { pane: false };
      const all = [...sc.querySelectorAll("div,span,img[alt],[aria-label]")].filter((e) => (e.tagName === "IMG" || e.children.length <= 3) && emojiLike(e));
      return { pane: true, badges: reactionEls().length, emojiLike: all.length,
        sample: all.slice(0, 4).map((e) => { const b = e.getBoundingClientRect(); return { tag: e.tagName, w: Math.round(b.width), h: Math.round(b.height), html: e.outerHTML.slice(0, 160) }; }) };
    },
    removePoint(mode) { // step 3: where to click "Click to remove" (mode 0 = the text, 1 = its clickable row)
      if (!curR || !curR.isConnected) return null;
      return pointOf(mode === 1 ? clickable(curR) : curR);
    },
    softRemove() { if (curR && curR.isConnected) softClick(clickable(curR)); },
    async reactionRemoved() { // step 4: did the remove row go away?
      for (let i = 0; i < 30; i++) { await sleep(100); if (!removeLabel()) { await closeDialog(); curR = null; return true; } }
      return false;
    },
    async skipReaction() { await closeDialog(); },
    requeue() { if (curRow && curRow.isConnected && !curRow.dataset.mcretry) { curRow.dataset.mcretry = "1"; delete curRow.dataset.mc; return true; } return false; },
    requeueReaction() { if (curBadge && curBadge.isConnected && !curBadge.dataset.mcretry) { curBadge.dataset.mcretry = "1"; delete curBadge.dataset.mcr; return true; } return false; },
    // Error popups / toasts ("Something went wrong", "Try again", rate-limit notices...): where to click to dismiss or retry.
    errorPoint() {
      const ERR = /(something went wrong|went wrong|try again|couldn.?t|could not|unable to|failed|error|problem|too many|slow down|temporarily|wait a few)/i;
      const RATE = /(wait a few|too many|slow down|temporarily|try again later)/i;
      const roots = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="alert"]')].filter(vis).reverse();
      for (const r of roots) {
        const text = (r.innerText || "").replace(/\s+/g, " ").slice(0, 200);
        if (!ERR.test(text)) continue;
        const btns = [...r.querySelectorAll(CLICKY)].filter(vis).map((b) => ({ b, t: (b.innerText || b.getAttribute("aria-label") || "").trim().split("\n")[0] }));
        const pick = btns.find((x) => /^(try again|retry)$/i.test(x.t)) || btns.find((x) => /^(ok|okay|dismiss|got it|reload|reload page)$/i.test(x.t));
        if (pick) return { pt: pointOf(pick.b), label: pick.t, text, rate: RATE.test(text) };
      }
      const t = findAct(/^(try again|retry)$/i); // toasts / inline error banners
      if (t) return { pt: pointOf(t), label: "Try again", text: "(banner)", rate: false };
      return null;
    },
    async openYourActivity() { // like a person: sidebar "More" -> "Your activity"
      const nav = () => document.querySelector('nav,[role="navigation"]');
      const more = await waitFor(() => (nav() && findAct(/^more$/i, nav())) || ((document.querySelector('svg[aria-label="Settings"]') || { closest: () => null }).closest(CLICKY)) || findAct(/^more$/i), 12000);
      if (!more) return { ok: false, step: "more-button", snap: window.__mc.snapshot() };
      more.click(); await sleep(900);
      const ya = await waitFor(() => findAct(/^your activity$/i), 6000);
      if (!ya) return { ok: false, step: "your-activity-item", snap: window.__mc.snapshot() };
      ya.click(); await sleep(2500);
      return { ok: true, snap: window.__mc.snapshot() };
    },
    snapshot() { // what the page looks like right now (for logs)
      const heads = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(vis).map((e) => (e.innerText || "").trim()).filter(Boolean).slice(0, 6);
      return { url: location.pathname, headings: heads, buttons: labelsNow(), checkboxes: document.querySelectorAll('[role="checkbox"],input[type="checkbox"]').length, tiles: tileEls().length };
    },
    async hasSelect(ms) { return !!(await waitFor(() => findAct(/^select$/i), ms || 8000)); },
    async navPath(labels) {
      for (const l of labels) {
        const re = new RegExp("^" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i");
        const el = await waitFor(() => findAct(re), 10000);
        if (!el) return { ok: false, missing: l, labels: labelsNow() };
        el.click(); await sleep(1800);
      }
      return { ok: true };
    },
    // Scrolls the activity list down so Instagram loads more items (it only loads ~27 at a time), up to `max` items.
    async loadMore(max) {
      const first = tileEls()[0] || findAct(/^select$/i);
      const sc = (first && vScroller(first)) || document.scrollingElement || document.documentElement;
      const count = () => Math.max(tileEls().length, document.querySelectorAll('[role="checkbox"],input[type="checkbox"]').length);
      let same = 0, lastH = -1, lastN = -1;
      for (let i = 0; i < 120 && same < 4 && count() < max; i++) {
        sc.scrollTo(0, sc.scrollHeight); window.scrollTo(0, document.body.scrollHeight); await sleep(550);
        const h = sc.scrollHeight, n = count(); same = (h === lastH && n === lastN) ? same + 1 : 0; lastH = h; lastN = n;
      }
      const n = count(); sc.scrollTo(0, 0); window.scrollTo(0, 0); await sleep(500);
      return n;
    },
    // Activity step 1: enter Select mode and select everything that's loaded.
    async actPrep(dry) {
      await window.__mc.dismiss();
      const sel = await waitFor(() => findAct(/^select$/i), 8000);
      if (!sel) return { selected: 0, reason: "no-select-button", snap: window.__mc.snapshot() };
      actBefore = tileKey();
      sel.click();
      await waitFor(() => findAct(/^select all$/i) || document.querySelector('[role="checkbox"],input[type="checkbox"],[aria-label*="Toggle checkbox"]'), 4000); await sleep(200);
      let clicked = 0; const all = findAct(/^select all$/i);
      if (all) { all.click(); await sleep(700); }
      else {
        const boxes = [...document.querySelectorAll('[role="checkbox"],input[type="checkbox"],[aria-label*="Toggle checkbox"]')].filter(vis).slice(0, 1000);
        for (const b of boxes) { b.click(); clicked++; if (clicked % 25 === 0) await sleep(0); }
        if (!boxes.length) for (const t of tileEls().slice(0, 1000)) { t.click(); clicked++; if (clicked % 25 === 0) await sleep(0); }
        await sleep(300);
      }
      const body = document.body.innerText || "", m = body.match(/(\d+)\s*(?:items?\s*)?selected/i) || body.match(/selected[:\s]+(\d+)/i);
      const n = m ? Number(m[1]) : (clicked || (all ? 1 : 0));
      if (!n) { const snap = window.__mc.snapshot(); await window.__mc.actCancel(); return { selected: 0, reason: "nothing-selectable", snap }; }
      if (dry) { await window.__mc.actCancel(); return { selected: n }; }
      return { selected: n, clicked };
    },
    // Activity step 2: where is the bottom-bar action button (Unlike / Delete / ...)?
    async actionPoint(src) {
      const re = new RegExp(src, "i");
      const el = await waitFor(() => {
        const leaves = [...document.querySelectorAll("*")].filter((e) => e.children.length === 0 && vis(e) && re.test((e.textContent || "").trim()));
        const low = leaves.filter((e) => e.getBoundingClientRect().top > innerHeight * 0.45); // the action bar sits at the bottom
        const leaf = (low.length ? low : leaves).pop();
        return leaf ? (leaf.closest(CLICKY) || leaf) : null;
      }, 5000);
      if (!el) return { ok: false, snap: window.__mc.snapshot() };
      actEl = el; return { ok: true, pt: pointOf(el) };
    },
    softAct() { if (actEl && actEl.isConnected) softClick(actEl); },
    // Activity step 3: wait for the confirm dialog and say where its confirm button is.
    async confirmPoint(wait) {
      const dlg = await waitFor(dlgNow, wait || 3500);
      if (!dlg) return { dialog: false };
      await sleep(250);
      const btns = [...dlg.querySelectorAll(CLICKY)].filter(vis).map((b) => ({ b, t: (b.innerText || b.getAttribute("aria-label") || "").trim().split("\n")[0] })).filter((x) => x.t);
      const bad = /^(cancel|not now|close|no)$/i, good = /^(unlike|delete|remove|confirm|yes|unrepost|undo|clear|ok)/i;
      const pick = btns.filter((x) => good.test(x.t) && x.t.length <= 30).pop() || btns.filter((x) => !bad.test(x.t)).pop();
      if (!pick) return { dialog: true, pt: null, buttons: btns.map((x) => x.t), snap: window.__mc.snapshot() };
      confirmEl = pick.b;
      let pt = pointOf(pick.b);
      for (let i = 0; i < 8; i++) { await sleep(120); const p2 = pointOf(pick.b); if (p2 && pt && Math.abs(p2.x - pt.x) < 2 && Math.abs(p2.y - pt.y) < 2) break; pt = p2; }
      return { dialog: true, pt, label: pick.t };
    },
    // Activity step 4: wait for the dialog to close and the list to change.
    async actFinish() {
      for (let i = 0; i < 60; i++) { await sleep(100); if (!dlgNow()) break; }
      for (let i = 0; i < 40; i++) { // wait until the list visibly changes (up to ~8s)
        await sleep(200);
        if (!actBefore || tileKey() !== actBefore) { await sleep(actBefore ? 500 : 1500); return { ok: true }; }
      }
      return { ok: false, reason: "items-still-there-after-action", snap: window.__mc.snapshot() };
    },
    async actCancel() { const cx = findAct(/^cancel$/i); if (cx) cx.click(); else await closeMenus(); await sleep(500); },
    async deleteNote(dry) { // your own Note ("status") in the inbox tray
      const note = await waitFor(() => findAct(/^your note$/i), 8000);
      if (!note) return { found: false, labels: labelsNow() };
      if (dry) return { found: true, ok: true };
      note.click(); await sleep(900);
      const del = await waitFor(() => findAct(/^delete note$/i, undefined, true), 4000);
      if (!del) { await closeMenus(); return { found: true, ok: false, reason: "no-delete-note-button", labels: labelsNow() }; }
      del.click(); await sleep(800);
      const dlg = document.querySelector('[role="dialog"]');
      if (dlg) { const cf = findAct(/^(delete|confirm|yes|ok)/i, dlg, true); if (cf) cf.click(); }
      await sleep(1500); return { found: true, ok: true };
    },
    async skip() { await closeMenus(); },
    async unsend() { // clicks "Unsend" in the open menu, then confirms in the dialog
      if (!cur || !cur.isConnected) return { ok: false, reason: "menu-closed" };
      (cur.closest('[role="menuitem"],[role="button"],button') || cur).click();
      const findConfirm = () => {
        const ex = document.getElementsByClassName(CONFIRM)[0]; if (ex) return ex;
        const d = document.querySelector('[role="dialog"]');
        return d && [...d.querySelectorAll('button,[role="button"]')].find((b) => /unsend/i.test(b.textContent || ""));
      };
      let confirm = null;
      for (let i = 0; i < 25 && !confirm; i++) { await sleep(i ? 100 : 250); confirm = findConfirm(); }
      if (!confirm) return { ok: false, reason: "no-confirm-dialog" };
      confirm.click();
      for (let i = 0; i < 50; i++) { await sleep(100); if (!document.querySelector('[role="dialog"]')) return { ok: true }; }
      return { ok: false, reason: "dialog-stuck" };
    },
    async dismiss() { // "Turn on notifications" etc.
      const b = [...document.querySelectorAll('button,[role="button"]')].find((e) => /^(not now|decline optional cookies|allow all cookies)$/i.test((e.textContent || "").trim()));
      if (b) { b.click(); await sleep(500); return true; } return false;
    },
    diag() {
      const q = (x) => document.querySelectorAll(x).length;
      return { url: location.href, title: document.title, links: q('a[href^="/direct/t/"]'), pagelet: q('[data-pagelet*="InboxThreadList"]'),
        chatsAria: q('[aria-label="Chats"]'), buttons: q('[role="button"]'), text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 200) };
    },
    async chats() {
      for (let i = 0; i < 30 && !chatRows().length; i++) { await window.__mc.dismiss(); await sleep(500); } // wait up to ~15s
      const out = new Map();
      const grab = () => chatRows().forEach((r) => {
        const href = r.getAttribute && r.getAttribute("href"), m = href && href.match(/\/direct\/t\/(\d+)/);
        const name = rowName(r) || "Chat", id = m ? m[1] : "n:" + name;
        if (!out.has(id)) out.set(id, name);
      });
      grab();
      const sc = vScroller(chatRows()[0]);
      let stable = 0;
      for (let i = 0; i < 150 && sc && stable < 6; i++) { const before = out.size; sc.scrollBy(0, 700); await sleep(700); grab(); stable = out.size === before ? stable + 1 : 0; }
      if (sc) { sc.scrollTo(0, 0); await sleep(300); }
      return [...out].map(([id, name]) => ({ id, name }));
    },
    // Opens the first conversation (in inbox order) that isn't in `done`; scrolls the list to find more. null = none left.
    async openNext(done) {
      const seen = new Set(done);
      for (let i = 0; i < 40 && !chatRows().length; i++) { await window.__mc.dismiss(); await sleep(500); }
      let stuck = 0;
      for (let i = 0; i < 200; i++) {
        const rows = chatRows(), cnt = {};
        for (const r of rows) {
          const n = rowName(r); cnt[n] = (cnt[n] || 0) + 1; const key = n + "#" + cnt[n];
          if (!seen.has(key)) { r.scrollIntoView({ block: "center" }); await sleep(200); r.click(); await sleep(2500); return { key, name: n }; }
        }
        const sc = vScroller(rows[0]); if (!sc) return null;
        const before = sc.scrollTop; sc.scrollBy(0, 600); await sleep(700);
        stuck = sc.scrollTop === before ? stuck + 1 : 0; if (stuck >= 3) return null;
      }
      return null;
    },
    async openChat(name) { // for chats that have no link: click the row with this name
      const sc = vScroller(chatRows()[0]);
      for (let i = 0; i < 150; i++) {
        const row = chatRows().find((r) => rowName(r) === name);
        if (row) { row.scrollIntoView({ block: "center" }); await sleep(200); row.click(); await sleep(2500); return true; }
        if (!sc) break; sc.scrollBy(0, 600); await sleep(500);
      }
      return false;
    },
  };
})();
