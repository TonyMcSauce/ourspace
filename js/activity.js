/**
 * activity.js
 * "What's new" across the app:
 *   - a badge on every tab (unread messages, new love notes, new
 *     memories, new reasons / capsules / list items in Together),
 *     cleared when you open that tab
 *   - the Home Screen icon badge, where the device allows it
 *   - a small banner that slides down when a message arrives while
 *     you're somewhere other than the chat
 *
 * "New" means added by the other person since you last opened that tab.
 * Those times are remembered per person on this device.
 */

const Activity = (() => {
  const TABS = ["chat", "notes", "memories", "together"];
  let lastBannerTs = 0;
  let started = false;

  const me = () => Auth.currentUser();
  const key = () => `ourspace_seen_${me() ? me().id : "x"}`;

  function readSeen() {
    try {
      return JSON.parse(localStorage.getItem(key()) || "null");
    } catch {
      return null;
    }
  }
  function writeSeen(seen) {
    try {
      localStorage.setItem(key(), JSON.stringify(seen));
    } catch {}
  }
  function seen() {
    let s = readSeen();
    if (!s) {
      // First time on this device: nothing counts as "new" yet.
      const now = Date.now();
      s = { notes: now, memories: now, together: now };
      writeSeen(s);
    }
    return s;
  }
  function markSeen(tab) {
    if (tab === "chat" || !TABS.includes(tab)) return;
    const s = seen();
    s[tab] = Date.now();
    writeSeen(s);
  }

  function counts() {
    const user = me();
    if (!user) return {};
    const s = seen();
    const theirs = (who) => who && who !== user.id;
    const chat = (Storage.getMessages() || []).filter((m) => m.from !== user.id && m.kind !== "call" && m.status !== "read").length;
    const notes = (Storage.getNotes() || []).filter((n) => theirs(n.author) && (n.date || 0) > s.notes).length;
    const memories = (Storage.getMemories() || []).filter((m) => theirs(m.addedBy) && (m.addedAt || 0) > s.memories).length;
    const together =
      Storage.getJar().filter((j) => theirs(j.from) && !(j.readBy || []).includes(user.id)).length +
      Storage.getCapsules().filter((c) => theirs(c.from) && (c.ts || 0) > s.together).length +
      Storage.getLists().filter((l) => theirs(l.by) && (l.ts || 0) > s.together).length +
      Storage.getListItems().filter((i) => theirs(i.by) && (i.ts || 0) > s.together).length;
    return { chat, notes, memories, together };
  }

  function paint() {
    if (!Auth.isAuthenticated()) return;
    const route = Router.current();
    if (route && route !== "chat") markSeen(route); // looking at it counts as seen
    const c = counts();
    TABS.forEach((tab) => {
      const n = tab === route && tab !== "chat" ? 0 : c[tab] || 0;
      document.querySelectorAll(`[data-badge="${tab}"]`).forEach((b) => {
        b.hidden = n === 0;
        b.textContent = n > 99 ? "99+" : String(n);
        b.classList.toggle("nav-badge--dot", tab !== "chat");
      });
    });
    try {
      const total = (c.chat || 0) + (c.notes || 0) + (c.memories || 0) + (c.together || 0);
      if (total && navigator.setAppBadge) navigator.setAppBadge(total);
      else if (!total && navigator.clearAppBadge) navigator.clearAppBadge();
    } catch {}
  }

  // ---------------------------------------------------------------
  // In-app banner for new messages
  // ---------------------------------------------------------------
  function latestTheirs() {
    const user = me();
    const list = (Storage.getMessages() || []).filter((m) => user && m.from !== user.id);
    return list.length ? list[list.length - 1] : null;
  }

  function snippetOf(m) {
    if (m.kind === "nudge") return "is thinking of you ♥";
    if (m.kind === "voice") return "sent a voice note";
    if (m.kind === "call") return m.callState === "missed" ? "tried to call you" : "called you";
    if (m.image && !m.text) return "sent a photo";
    const t = String(m.text || "").replace(/\s+/g, " ").trim();
    return t.length > 70 ? t.slice(0, 68) + "…" : t;
  }

  function showBanner(m) {
    const from = CONFIG.users[m.from];
    if (!from) return;
    document.querySelectorAll(".msg-banner").forEach((el) => el.remove());
    const el = document.createElement("button");
    el.type = "button";
    el.className = "msg-banner";
    el.setAttribute("aria-label", `New message from ${from.displayName}. Open chat.`);
    el.innerHTML = `
      ${Avatars.html(from, "avatar--sm")}
      <span class="msg-banner__text">
        <span class="msg-banner__name">${UI.escape(from.displayName)}</span>
        <span class="msg-banner__body">${UI.escape(snippetOf(m))}</span>
      </span>
      <span class="msg-banner__go" aria-hidden="true">${UI.icon("chevronRight")}</span>`;
    const close = () => {
      el.classList.remove("msg-banner--in");
      setTimeout(() => el.remove(), 350);
    };
    el.addEventListener("click", () => {
      close();
      location.hash = "#/chat";
    });
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("msg-banner--in"));
    setTimeout(close, 4500);
  }

  function onMessages() {
    const m = latestTheirs();
    if (!m || m.ts <= lastBannerTs) return;
    lastBannerTs = m.ts;
    const fresh = Date.now() - m.ts < 60 * 1000;
    const elsewhere = Router.current() !== "chat";
    const quiet = document.body.classList.contains("is-locked") || document.querySelector(".heartbeat, .call-screen");
    if (fresh && elsewhere && !quiet && m.kind !== "nudge" && m.kind !== "call" && document.visibilityState === "visible") showBanner(m);
  }

  function start() {
    const m = latestTheirs();
    lastBannerTs = m ? m.ts : 0;
    if (started) return;
    started = true;
    Storage.onChange((kind) => {
      if (!Auth.isAuthenticated()) return;
      if (kind === "messages") onMessages();
      if (["messages", "notes", "memories", "jar", "capsules", "lists", "listItems"].includes(kind)) paint();
    });
    window.addEventListener("hashchange", () => setTimeout(paint, 50));
  }

  return { start, paint };
})();
