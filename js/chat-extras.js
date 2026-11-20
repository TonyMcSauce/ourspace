/**
 * chat-extras.js
 * The chat's extra screens, kept out of chat.js:
 *
 *   - Chat info (tap her name): Search, Photos, Wallpaper
 *   - Search the conversation and jump to a message
 *   - Photos: every shared photo by month, with Save and "Show in chat"
 *   - Check-ins: one tap "Home safe 🏠" style messages
 *   - Send later: scheduled messages, delivered by the notifier
 *
 * chat.js passes a small context object:
 *   { me, other, root, loadMessages, showMessage(id), send(partial),
 *     textarea, syncComposer, openWallpaper() }
 */

const ChatExtras = (() => {
  const esc = (s) => UI.escape(String(s == null ? "" : s));

  // ---------------------------------------------------------------
  // Check-ins
  // ---------------------------------------------------------------
  const CHECKINS = [
    { id: "home", text: "Home safe", emoji: "🏠" },
    { id: "leaving", text: "Leaving work", emoji: "🚗" },
    { id: "onway", text: "On my way", emoji: "🏃" },
    { id: "morning", text: "Good morning", emoji: "☀️" },
    { id: "night", text: "Goodnight", emoji: "🌙" },
    { id: "miss", text: "Miss you", emoji: "🥺" },
  ];
  const checkinById = (id) => CHECKINS.find((c) => c.id === id);

  function checkinHtml(m) {
    const c = checkinById(m.checkin) || { emoji: "📍", text: m.text || "Checked in" };
    return `
      <span class="checkin">
        <span class="checkin__emoji" aria-hidden="true">${esc(c.emoji)}</span>
        <span class="checkin__body">
          <span class="checkin__label">Check-in</span>
          <span class="checkin__text">${esc(c.text)}</span>
        </span>
      </span>`;
  }

  function openCheckins(ctx) {
    const panel = UI.openModal({
      variant: "modal__panel--sheet",
      label: "Check in",
      content: `
        <h2 class="sheet-title">Check in</h2>
        <p class="sheet-sub">One tap, and ${esc(ctx.other.displayName)} gets a little notification.</p>
        <div class="checkin-grid">
          ${CHECKINS.map((c) => `<button type="button" class="checkin-choice" data-checkin="${c.id}"><span class="checkin-choice__emoji">${c.emoji}</span><span>${esc(c.text)}</span></button>`).join("")}
        </div>`,
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-checkin]");
      if (!b) return;
      const c = checkinById(b.dataset.checkin);
      UI.closeModal();
      if (navigator.vibrate) navigator.vibrate(10);
      ctx.send({ kind: "checkin", checkin: c.id, text: `${c.text} ${c.emoji}` }, { notify: ["checkin", { preset: c.id }] });
    });
  }

  // ---------------------------------------------------------------
  // Chat info sheet
  // ---------------------------------------------------------------
  function openInfo(ctx) {
    const photos = ctx.loadMessages().filter((m) => m.image).length;
    const panel = UI.openModal({
      variant: "modal__panel--sheet chat-info",
      label: `About your chat with ${ctx.other.displayName}`,
      content: `
        <div class="chat-info__head">
          ${Avatars.html(ctx.other, "avatar--hero")}
          <h2 class="chat-info__name">${esc(ctx.other.displayName)}</h2>
          <p class="chat-info__status">${esc(ctx.statusText())}</p>
        </div>
        <div class="chat-info__actions">
          <button type="button" class="chat-info__action" data-info="search">${UI.icon("search")}<span>Search</span></button>
          <button type="button" class="chat-info__action" data-info="photos">${UI.icon("photos")}<span>Photos${photos ? ` · ${photos}` : ""}</span></button>
          <button type="button" class="chat-info__action" data-info="wallpaper">${UI.icon("wallpaper")}<span>Wallpaper</span></button>
        </div>`,
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-info]");
      if (!b) return;
      UI.closeModal();
      const what = b.dataset.info;
      setTimeout(() => {
        if (what === "search") openSearch(ctx);
        else if (what === "photos") openGallery(ctx);
        else if (what === "wallpaper") ctx.openWallpaper();
      }, 180);
    });
  }

  // ---------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------
  function highlight(text, words) {
    let out = esc(text);
    words.forEach((w) => {
      if (!w) return;
      const re = new RegExp(`(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function excerpt(text, word) {
    const i = word ? text.toLowerCase().indexOf(word) : -1;
    if (i < 40) return text.slice(0, 120);
    return "…" + text.slice(i - 30, i + 90);
  }

  function openSearch(ctx) {
    const view = ctx.root.querySelector(".chat-view");
    if (view.querySelector(".chat-search")) {
      view.querySelector(".chat-search__input").focus();
      return;
    }
    const box = document.createElement("div");
    box.className = "chat-search";
    box.innerHTML = `
      <div class="chat-search__bar">
        <label class="chat-search__field">
          ${UI.icon("search")}
          <input type="search" class="chat-search__input" placeholder="Search your chat" aria-label="Search your chat" autocomplete="off" enterkeyhint="search" />
        </label>
        <button type="button" class="chat-search__cancel">Cancel</button>
      </div>
      <div class="chat-search__results" role="list"></div>`;
    view.appendChild(box);
    const input = box.querySelector(".chat-search__input");
    const results = box.querySelector(".chat-search__results");
    requestAnimationFrame(() => input.focus());

    const close = () => {
      box.classList.add("chat-search--leaving");
      setTimeout(() => box.remove(), 200);
      document.removeEventListener("keydown", onKey);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    box.querySelector(".chat-search__cancel").addEventListener("click", close);
    Router.onLeave(close);

    let loadingOlder = false;
    const run = () => {
      const words = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      if (!words.length) {
        results.innerHTML = `<p class="chat-search__hint">Find a word, a place, a plan…</p>`;
        return;
      }
      const all = ctx.loadMessages();
      const hits = all
        .filter((m) => m.text && m.kind !== "call" && words.every((w) => m.text.toLowerCase().includes(w)))
        .reverse()
        .slice(0, 80);
      const more = Cloud.isActive() && Cloud.hasOlderMessages();
      results.innerHTML =
        (hits.length
          ? hits
              .map(
                (m) => `
          <button type="button" class="chat-search__hit" data-hit="${esc(m.id)}" role="listitem">
            ${Avatars.html(CONFIG.users[m.from] || ctx.other, "avatar--sm")}
            <span class="chat-search__body">
              <span class="chat-search__meta"><b>${esc(m.from === ctx.me.id ? "You" : (CONFIG.users[m.from] || {}).displayName || "")}</b> · ${esc(UI.dayLabel(m.ts))}, ${esc(new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span>
              <span class="chat-search__text">${highlight(excerpt(m.text, words[0]), words)}</span>
            </span>
          </button>`
              )
              .join("")
          : `<p class="chat-search__hint">No messages with “${esc(input.value.trim())}”${more ? " in recent messages" : ""}.</p>`) +
        (more ? `<button type="button" class="chat-search__older" ${loadingOlder ? "disabled" : ""}>${loadingOlder ? "Looking further back…" : "Search older messages too"}</button>` : "");
      Media.hydrate(results);
    };
    input.addEventListener("input", run);
    run();
    results.addEventListener("click", async (e) => {
      const hit = e.target.closest("[data-hit]");
      if (hit) {
        close();
        ctx.showMessage(hit.dataset.hit);
        return;
      }
      if (e.target.closest(".chat-search__older") && !loadingOlder) {
        loadingOlder = true;
        run();
        try {
          for (let i = 0; i < 10 && Cloud.hasOlderMessages(); i++) {
            const all = ctx.loadMessages();
            const added = await Cloud.loadOlderMessages(all.length ? all[0].ts : Date.now());
            if (!added) break;
            await new Promise((r) => setTimeout(r, 120));
          }
        } catch {
          Toast.show("Couldn't look further back. Check your connection.");
        }
        loadingOlder = false;
        run();
      }
    });
  }

  // ---------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------
  async function savePhoto(src) {
    try {
      const blob = await (await fetch(src)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const file = new File([blob], `our-space-${new Date().toISOString().slice(0, 10)}.${ext}`, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      Toast.show("Couldn't save that photo.");
    }
  }

  /** Full-screen photo with Save (and "Show in chat" from the gallery). */
  function openPhoto(src, { onShow } = {}) {
    const panel = UI.openModal({
      variant: "modal__panel--photo",
      label: "Photo",
      content: `
        <img class="photo-viewer" src="${esc(src)}" alt="Shared photo" />
        <div class="photo-viewer__bar">
          <button type="button" class="photo-viewer__btn" data-photo="save">${UI.icon("share")}<span>Save</span></button>
          ${onShow ? `<button type="button" class="photo-viewer__btn" data-photo="show">${UI.icon("chat")}<span>Show in chat</span></button>` : ""}
        </div>`,
    });
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-photo]");
      if (!b) return;
      if (b.dataset.photo === "save") savePhoto(src);
      else {
        UI.closeModal();
        onShow();
      }
    });
  }

  function openGallery(ctx) {
    const photos = ctx.loadMessages().filter((m) => m.image).reverse();
    const groups = [];
    photos.forEach((m) => {
      const label = new Date(m.ts).toLocaleDateString([], { month: "long", year: "numeric" });
      const g = groups[groups.length - 1];
      if (g && g.label === label) g.items.push(m);
      else groups.push({ label, items: [m] });
    });
    const panel = UI.openModal({
      variant: "modal__panel--sheet gallery",
      label: "Photos",
      content: `
        <h2 class="sheet-title">Photos</h2>
        <p class="sheet-sub">${photos.length ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"} you've shared` : "Photos you send each other will gather here."}</p>
        <div class="gallery__scroll">
          ${groups
            .map(
              (g) => `
            <h3 class="gallery__month">${esc(g.label)}</h3>
            <div class="gallery__grid">
              ${g.items.map((m) => `<button type="button" class="gallery__item" data-photo-id="${esc(m.id)}" data-image="${esc(m.image)}" aria-label="Photo from ${esc(UI.dayLabel(m.ts))}"><img ${Media.attrs(m.image, "src")} alt="" loading="lazy" /></button>`).join("")}
            </div>`
            )
            .join("")}
        </div>`,
    });
    Media.hydrate(panel);
    panel.addEventListener("click", (e) => {
      const item = e.target.closest("[data-photo-id]");
      if (!item) return;
      const id = item.dataset.photoId;
      Media.load(item.dataset.image).then((src) => {
        if (!src) return;
        openPhoto(src, { onShow: () => ctx.showMessage(id) });
      });
    });
  }

  // ---------------------------------------------------------------
  // Send later
  // ---------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, "0");
  const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  function whenLabel(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const day = UI.dayLabel(ts);
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
    return `${day}, ${time}`;
  }
  function presets() {
    const now = new Date();
    const at = (days, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m);
    const list = [];
    if (now.getHours() < 20) list.push(["Tonight, 9 PM", at(0, 21)]);
    list.push(["Midnight", at(1, 0, 0)]);
    list.push(["Tomorrow, 7 AM", at(1, 7)]);
    list.push(["Tomorrow, 12 PM", at(1, 12)]);
    return list;
  }

  function openSchedule(ctx, existing = null) {
    const draft = existing ? existing.text : ctx.textarea.value.trim();
    const initial = existing ? new Date(existing.sendAt) : presets()[0][1];
    const panel = UI.openModal({
      variant: "modal__panel--sheet",
      label: "Send later",
      content: `
        <h2 class="sheet-title">${existing ? "Change scheduled message" : "Send later"}</h2>
        <p class="sheet-sub">It stays hidden from ${esc(ctx.other.displayName)} until it arrives, even if both phones are off.</p>
        <form class="schedule-form" novalidate>
          <textarea class="field__input field__input--area schedule-form__text" rows="3" maxlength="5000" placeholder="Write something to arrive later…" required>${esc(draft)}</textarea>
          <div class="schedule-form__chips">
            ${presets().map(([label, d]) => `<button type="button" class="chip" data-at="${d.getTime()}">${esc(label)}</button>`).join("")}
          </div>
          <label class="schedule-form__when">
            <span>Deliver on</span>
            <input type="datetime-local" class="field__input schedule-form__time" value="${toLocalInput(initial)}" min="${toLocalInput(new Date())}" required />
          </label>
          <p class="schedule-form__error" role="alert" hidden></p>
          <button type="submit" class="btn btn--primary btn--block">${UI.icon("clock")}<span>${existing ? "Save changes" : "Schedule"}</span></button>
        </form>`,
    });
    const form = panel.querySelector(".schedule-form");
    const text = panel.querySelector(".schedule-form__text");
    const time = panel.querySelector(".schedule-form__time");
    const error = panel.querySelector(".schedule-form__error");
    const markChip = () => {
      const t = new Date(time.value).getTime();
      panel.querySelectorAll("[data-at]").forEach((c) => c.classList.toggle("chip--on", Math.abs(Number(c.dataset.at) - t) < 60000));
    };
    markChip();
    time.addEventListener("input", markChip);
    panel.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-at]");
      if (!chip) return;
      time.value = toLocalInput(new Date(Number(chip.dataset.at)));
      markChip();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = text.value.trim();
      const sendAt = new Date(time.value).getTime();
      const fail = (msg) => {
        error.textContent = msg;
        error.hidden = false;
      };
      if (!body) return fail("Write a message first.");
      if (!sendAt || Number.isNaN(sendAt)) return fail("Pick a day and time.");
      if (sendAt < Date.now() + 30 * 1000) return fail("Pick a time in the future.");
      const item = {
        id: existing ? existing.id : UI.uid("s"),
        to: ctx.other.id,
        text: body,
        sendAt,
        createdAt: existing ? existing.createdAt : Date.now(),
      };
      try {
        await Cloud.saveScheduled(item);
        UI.closeModal();
        if (!existing && body === ctx.textarea.value.trim()) {
          ctx.textarea.value = "";
          ctx.syncComposer();
          ctx.textarea.dispatchEvent(new Event("input"));
        }
        Toast.show(`Scheduled for ${whenLabel(sendAt)}.`);
      } catch (err) {
        fail(err && err.code === "permission-denied" ? "Scheduling needs the updated Firebase rules." : "Couldn't schedule that. Check your connection.");
      }
    });
  }

  function openScheduledList(ctx, items) {
    const panel = UI.openModal({
      variant: "modal__panel--sheet",
      label: "Scheduled messages",
      content: `
        <h2 class="sheet-title">Scheduled</h2>
        <p class="sheet-sub">Only you can see these until they arrive.</p>
        <div class="scheduled-list">
          ${items
            .map(
              (s) => `
            <div class="scheduled-item">
              <span class="scheduled-item__when">${UI.icon("clock")}${esc(whenLabel(s.sendAt))}</span>
              <p class="scheduled-item__text">${esc(s.text)}</p>
              <div class="scheduled-item__actions">
                <button type="button" class="btn btn--ghost btn--sm" data-edit="${esc(s.id)}">Change</button>
                <button type="button" class="btn btn--ghost btn--sm btn--danger-text" data-cancel="${esc(s.id)}">Cancel</button>
              </div>
            </div>`
            )
            .join("")}
        </div>`,
    });
    panel.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit]");
      const cancel = e.target.closest("[data-cancel]");
      if (edit) {
        const item = items.find((s) => s.id === edit.dataset.edit);
        UI.closeModal();
        setTimeout(() => openSchedule(ctx, item), 200);
      } else if (cancel) {
        UI.closeModal();
        const ok = await UI.confirm({ title: "Cancel this message?", message: "It won't be sent.", confirmLabel: "Cancel message", cancelLabel: "Keep it", danger: true });
        if (ok) Cloud.cancelScheduled(cancel.dataset.cancel).then(() => Toast.show("Cancelled.")).catch(() => Toast.show("Couldn't cancel. Check your connection."));
      }
    });
  }

  /** The little "2 scheduled · next Tomorrow, 7 AM" bar above the composer. */
  function watchScheduledBar(ctx, bar) {
    let items = [];
    const paint = () => {
      bar.hidden = !items.length;
      if (!items.length) return;
      bar.innerHTML = `${UI.icon("clock")}<span><b>${items.length} scheduled</b> · next ${esc(whenLabel(items[0].sendAt))}</span>${UI.icon("chevronRight")}`;
    };
    bar.addEventListener("click", () => items.length && openScheduledList(ctx, items));
    const off = Cloud.isActive() ? Cloud.watchScheduled((list) => {
      items = list;
      paint();
    }) : () => {};
    const tick = setInterval(paint, 60 * 1000);
    return () => {
      off();
      clearInterval(tick);
    };
  }

  return { CHECKINS, checkinHtml, openCheckins, openInfo, openSearch, openGallery, openPhoto, openSchedule, watchScheduledBar };
})();
