/**
 * emoji.js
 * An emoji keyboard in the spirit of the one on iPhone.
 *
 *  - Every emoji, grouped like iOS (Smileys & People, Animals & Nature,
 *    Food & Drink, Activity, Travel & Places, Objects, Symbols, Flags),
 *    plus "Frequently Used" and a "Love" set for the two of you.
 *  - Search by name ("heart", "laugh", "pizza").
 *  - Press and hold a hand or person to pick a skin tone; it's remembered.
 *  - On iPhone and Mac the system draws Apple's own emoji artwork.
 *
 * The full list (js/emoji-data.js) loads the first time the picker opens.
 *
 *   EmojiPicker.html()                 the empty shell (goes in the page)
 *   EmojiPicker.attach(el, { onPick }) wire it up; onPick(emoji)
 *   EmojiPicker.prepare(el)            load and draw (call when opening)
 */

const EmojiPicker = (() => {
  const RECENT_KEY = "ourspace_emoji_recent";
  const TONE_KEY = "ourspace_emoji_tones";
  const LOVE = [
    "❤️", "🩷", "🧡", "💛", "💚", "🩵", "💙", "💜", "🤎", "🖤", "🤍", "❤️‍🔥",
    "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "❣️", "💌", "💋", "😘",
    "😍", "🥰", "😻", "🫶", "🤗", "🥺", "😚", "😙", "💑", "💏", "🌹", "💐",
    "🌷", "🌸", "✨", "🌙", "⭐", "💍", "🧸", "🎀", "🍫", "🍓", "🥂", "🕯️",
  ];
  const DEFAULT_RECENT = ["❤️", "😂", "🥰", "😘", "😍", "🥺", "😊", "🤗", "😭", "🔥", "✨", "🙈"];

  // Small line icons for the category bar.
  const ICONS = {
    recent: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    love: '<path d="M12 19.5s-7-4.35-7-9.4A3.85 3.85 0 0 1 12 8a3.85 3.85 0 0 1 7 2.1c0 5.05-7 9.4-7 9.4z"/>',
    people: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 9.8h.01M15 9.8h.01"/>',
    nature: '<path d="M6 18c0-7 5-12 13-12 0 8-5 13-12 13"/><path d="M6 18l7-7"/>',
    food: '<path d="M12 8c-1.5-1.6-4.5-1.6-5.8.4-1.7 2.6-.4 7.5 2.1 9.6 1.1.9 2.2.6 3.7 0 1.5.6 2.6.9 3.7 0 2.5-2.1 3.8-7 2.1-9.6C16.5 6.4 13.5 6.4 12 8z"/><path d="M12 8c0-1.6.8-3 2.5-3.5"/>',
    activity: '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 7.5c3 1.6 4.5 4.2 4.5 8.4M18.5 7.5c-3 1.6-4.5 4.2-4.5 8.4M3.6 12h16.8"/>',
    travel: '<path d="M5 16V11.5L6.8 7h10.4l1.8 4.5V16z"/><path d="M5 11.5h14"/><circle cx="8" cy="13.8" r=".6"/><circle cx="16" cy="13.8" r=".6"/><path d="M6.5 16v2M17.5 16v2"/>',
    objects: '<path d="M9 17.5h6M10 20h4"/><path d="M12 4a5.5 5.5 0 0 0-3.2 10c.6.5.9 1.1.9 1.9V16h4.6v-.1c0-.8.3-1.4.9-1.9A5.5 5.5 0 0 0 12 4z"/>',
    symbols: '<path d="M8 5l-1.5 14M15.5 5L14 19M5 9.5h14M4.5 14.5h14"/>',
    flags: '<path d="M6 20V4.5"/><path d="M6 5c4-2 6 2 12 0v8.5c-6 2-8-2-12 0"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.3-4.3"/>',
  };
  const icon = (name) =>
    `<svg class="ep__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------------------------------------------------------------
  // Remembered things (this device only)
  // ---------------------------------------------------------------
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  /** Frequently used: a decaying score, so new favourites rise quickly. */
  function recents() {
    const scores = read(RECENT_KEY, {});
    const list = Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([e]) => e);
    return [...list, ...DEFAULT_RECENT.filter((e) => !list.includes(e))].slice(0, 24);
  }
  function bump(emoji) {
    const scores = read(RECENT_KEY, {});
    Object.keys(scores).forEach((k) => (scores[k] *= 0.94));
    scores[emoji] = (scores[emoji] || 0) + 1;
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 40);
    write(RECENT_KEY, Object.fromEntries(top));
  }

  // ---------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------
  let loading = null;
  let skins = new Map(); // base emoji -> [5 tones]
  let toneOf = new Map(); // any variant -> base
  let names = new Map(); // emoji -> name
  function load() {
    if (window.EMOJI_DATA) return Promise.resolve(window.EMOJI_DATA);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "js/emoji-data.js";
      s.onload = () => resolve(window.EMOJI_DATA);
      s.onerror = () => {
        loading = null;
        reject(new Error("Couldn't load emoji"));
      };
      document.head.appendChild(s);
    });
    return loading;
  }
  function index(data) {
    if (names.size) return;
    data.forEach(([, , items]) =>
      items.forEach(([e, name, , tones]) => {
        names.set(e, name);
        if (tones) {
          skins.set(e, tones);
          tones.forEach((t) => toneOf.set(t, e));
        }
      })
    );
  }
  const preferredTone = (base) => read(TONE_KEY, {})[base] || base;

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  function html() {
    return `
      <div class="popover emoji-picker ep" id="emoji-picker" hidden role="dialog" aria-label="Emoji">
        <label class="ep__search">
          ${icon("search")}
          <input type="search" class="ep__query" placeholder="Search Emoji" aria-label="Search emoji" autocomplete="off" enterkeyhint="done" />
        </label>
        <div class="ep__body" tabindex="-1">
          <div class="ep__loading" aria-hidden="true"></div>
        </div>
        <nav class="ep__tabs" aria-label="Emoji categories"></nav>
        <div class="ep__tones" hidden role="listbox" aria-label="Skin tone"></div>
      </div>`;
  }

  function cell(e) {
    const base = toneOf.get(e) || e;
    const shown = skins.has(base) ? preferredTone(base) : e;
    const name = names.get(base) || "emoji";
    return `<button type="button" class="ep__e" data-e="${esc(shown)}"${skins.has(base) ? ` data-base="${esc(base)}"` : ""} aria-label="${esc(name)}">${shown}</button>`;
  }

  function section(id, label, list) {
    return `
      <section class="ep__section" data-cat="${id}" aria-label="${esc(label)}">
        <h3 class="ep__title">${esc(label)}</h3>
        <div class="ep__grid">${list.map(cell).join("")}</div>
      </section>`;
  }

  function draw(el, data) {
    index(data);
    const cats = [
      ["recent", "Frequently Used", recents()],
      ["love", "Love", LOVE],
      ...data.map(([id, label, items]) => [id, label, items.map((i) => i[0])]),
    ];
    el.querySelector(".ep__body").innerHTML = cats.map(([id, label, list]) => section(id, label, list)).join("");
    el.querySelector(".ep__tabs").innerHTML = cats
      .map(([id, label], i) => `<button type="button" class="ep__tab${i === 0 ? " is-active" : ""}" data-tab="${id}" aria-label="${esc(label)}">${icon(id)}</button>`)
      .join("");
    el.dataset.ready = "1";
  }

  function redrawRecents(el) {
    const grid = el.querySelector('.ep__section[data-cat="recent"] .ep__grid');
    if (grid) grid.innerHTML = recents().map(cell).join("");
  }

  function search(el, q) {
    const body = el.querySelector(".ep__body");
    let results = body.querySelector(".ep__results");
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    el.classList.toggle("ep--searching", words.length > 0);
    if (!words.length) {
      if (results) results.remove();
      return;
    }
    const hits = [];
    (window.EMOJI_DATA || []).forEach(([, , items]) =>
      items.forEach(([e, name, tags]) => {
        const lower = name.toLowerCase();
        const hay = ` ${lower} ${tags} `;
        if (!words.every((w) => hay.includes(w))) return;
        // Best first: the word in the name itself, then shorter (simpler)
        // names, so "heart" leads with ❤️ rather than 💘.
        const inName = ` ${lower} `.includes(` ${words[0]} `) ? 0 : ` ${lower}`.includes(` ${words[0]}`) ? 1 : 2;
        hits.push([inName * 1000 + lower.length, e]);
      })
    );
    hits.sort((a, b) => a[0] - b[0]);
    if (!results) {
      results = document.createElement("section");
      results.className = "ep__section ep__results";
      body.prepend(results);
    }
    results.innerHTML = hits.length
      ? `<h3 class="ep__title">Results</h3><div class="ep__grid">${hits.slice(0, 96).map(([, e]) => cell(e)).join("")}</div>`
      : `<p class="ep__empty">No emoji found</p>`;
    body.scrollTop = 0;
  }

  // ---------------------------------------------------------------
  // Behaviour
  // ---------------------------------------------------------------
  function attach(el, { onPick }) {
    const body = el.querySelector(".ep__body");
    const tabs = el.querySelector(".ep__tabs");
    const query = el.querySelector(".ep__query");
    const tones = el.querySelector(".ep__tones");

    const pick = (emoji, btn) => {
      bump(emoji);
      if (btn) {
        btn.classList.remove("ep__e--pop");
        void btn.offsetWidth;
        btn.classList.add("ep__e--pop");
      }
      onPick(emoji);
    };

    // Tap an emoji (press and hold a skinnable one for tones).
    let hold = null;
    let held = false;
    body.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".ep__e[data-base]");
      held = false;
      if (!btn) return;
      clearTimeout(hold);
      hold = setTimeout(() => {
        held = true;
        showTones(btn);
      }, 380);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((t) => body.addEventListener(t, () => clearTimeout(hold)));
    body.addEventListener("scroll", () => clearTimeout(hold), { passive: true });
    body.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".ep__e")) e.preventDefault();
    });
    body.addEventListener("click", (e) => {
      const btn = e.target.closest(".ep__e");
      if (!btn) return;
      e.stopPropagation();
      if (held) return; // the tone row is open instead
      pick(btn.dataset.e, btn);
    });

    function showTones(btn) {
      const base = btn.dataset.base;
      const list = [base, ...skins.get(base)];
      tones.innerHTML = list
        .map((t, i) => `<button type="button" class="ep__tone" data-tone="${esc(t)}" data-base="${esc(base)}" role="option" aria-label="${["Default", "Light", "Medium light", "Medium", "Medium dark", "Dark"][i]} skin tone">${t}</button>`)
        .join("");
      tones.hidden = false;
      const box = el.getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      const w = tones.offsetWidth;
      const left = Math.max(6, Math.min(box.width - w - 6, r.left - box.left + r.width / 2 - w / 2));
      tones.style.left = `${left}px`;
      tones.style.top = `${Math.max(6, r.top - box.top - tones.offsetHeight - 6)}px`;
      if (navigator.vibrate) navigator.vibrate(8);
    }
    tones.addEventListener("click", (e) => {
      const t = e.target.closest(".ep__tone");
      if (!t) return;
      e.stopPropagation();
      const prefs = read(TONE_KEY, {});
      prefs[t.dataset.base] = t.dataset.tone;
      write(TONE_KEY, prefs);
      el.querySelectorAll(`.ep__e[data-base="${CSS.escape(t.dataset.base)}"]`).forEach((b) => {
        b.dataset.e = t.dataset.tone;
        b.textContent = t.dataset.tone;
      });
      tones.hidden = true;
      held = false;
      pick(t.dataset.tone);
    });
    el.addEventListener("pointerdown", (e) => {
      if (!tones.hidden && !e.target.closest(".ep__tones")) {
        tones.hidden = true;
        // A tap outside closes the tones without picking anything.
        if (!e.target.closest(".ep__e[data-base]")) held = true;
      }
    });

    // Category bar: jump to a section; highlight the one you're in.
    tabs.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (!tab) return;
      e.stopPropagation();
      if (query.value) {
        query.value = "";
        search(el, "");
      }
      const sec = body.querySelector(`.ep__section[data-cat="${tab.dataset.tab}"]`);
      if (sec) body.scrollTo({ top: sec.offsetTop, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setActive(tab.dataset.tab);
    });
    function setActive(id) {
      tabs.querySelectorAll(".ep__tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === id));
    }
    let spy = false;
    body.addEventListener(
      "scroll",
      () => {
        if (spy) return;
        spy = true;
        requestAnimationFrame(() => {
          spy = false;
          if (el.classList.contains("ep--searching")) return;
          const y = body.scrollTop + 24;
          let current = "recent";
          body.querySelectorAll(".ep__section[data-cat]").forEach((s) => {
            if (s.offsetTop <= y) current = s.dataset.cat;
          });
          setActive(current);
        });
      },
      { passive: true }
    );

    // Search.
    query.addEventListener("input", () => search(el, query.value));
    query.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const first = body.querySelector(".ep__results .ep__e");
        if (first) pick(first.dataset.e, first);
      }
    });
    query.addEventListener("click", (e) => e.stopPropagation());

    el._redrawRecents = () => redrawRecents(el);
  }

  /** Load (once) and draw; refresh "Frequently Used" each time it opens. */
  async function prepare(el) {
    if (el.dataset.ready) {
      el._redrawRecents && el._redrawRecents();
      return;
    }
    try {
      draw(el, await load());
    } catch (err) {
      el.querySelector(".ep__body").innerHTML = `<p class="ep__empty">Couldn't load emoji. Check your connection.</p>`;
    }
  }

  function reset(el) {
    const q = el.querySelector(".ep__query");
    if (q && q.value) {
      q.value = "";
      search(el, "");
    }
    const tones = el.querySelector(".ep__tones");
    if (tones) tones.hidden = true;
  }

  return { html, attach, prepare, reset, load };
})();
