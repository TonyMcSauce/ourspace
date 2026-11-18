/**
 * together.js
 * The "Together" page: three keepsake rituals, each built as a small
 * 3D object with CSS transforms (no libraries, light on phones).
 *
 *   Love jar        { id, from, text, ts, readBy: [userId] }
 *   Time capsules   { id, from, title, message, photo?, openOn: "YYYY-MM-DD", ts, openedBy: [] }
 *   Shared lists    lists: { id, title, emoji, ts, by }
 *                   items: { id, listId, text, done, doneBy, doneAt, by, ts }
 */

const Together = (() => {
  let tab = "jar";
  try {
    tab = localStorage.getItem("ourspace_together_tab") || "jar";
  } catch {}

  const me = () => Auth.currentUser();
  const other = () => Auth.otherUser();
  const nameOf = (id) => (id === me().id ? "you" : CONFIG.users[id]?.displayName || id);

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967295;
  }

  // =================================================================
  // LOVE JAR
  // =================================================================
  const SLIP_COLOURS = ["#fbf3e4", "#f6dcd6", "#f3e6c4", "#e9eef0", "#f9e9df"];
  const PROMPTS = [
    "I love the way you…",
    "You make me feel…",
    "My favourite thing about you is…",
    "I'll never forget when you…",
    "You're the only person who…",
  ];

  function slipsFor(userId) {
    return Storage.getJar().filter((s) => s.from !== userId);
  }

  function jarHtml(freshId) {
    const slips = Storage.getJar();
    const forMe = slipsFor(me().id);
    const unread = forMe.filter((s) => !(s.readBy || []).includes(me().id));
    const pile = slips.slice(-42).map((s, i) => {
      // Deterministic, settled-looking pile: rows from the bottom up.
      const r1 = hash(s.id + "x");
      const r2 = hash(s.id + "z");
      const r3 = hash(s.id + "r");
      const row = Math.floor(i / 6);
      const x = 10 + r1 * 62;
      const y = 88 - row * 9 - r2 * 6;
      const z = -34 + r2 * 68;
      const rot = -50 + r3 * 100;
      const colour = SLIP_COLOURS[Math.floor(r1 * SLIP_COLOURS.length)];
      return `<span class="slip ${s.id === freshId ? "slip--new" : ""}" style="--x:${x}%;--y:${Math.max(18, y)}%;--z:${z}px;--r:${rot}deg;--c:${colour}"></span>`;
    });

    return `
      <div class="jar-stage">
        <div class="jar-scene" id="jar-scene">
          <div class="jar" id="jar">
            <div class="jar__shadow"></div>
            <div class="jar__back"></div>
            <div class="jar__slips">${pile.join("")}</div>
            <div class="jar__front"><span class="jar__shine"></span><span class="jar__shine jar__shine--thin"></span></div>
            <div class="jar__label"><span>Reasons</span><em>I love you</em></div>
            <div class="jar__neck"></div>
            <div class="jar__lid"><span class="jar__lid-top"></span><span class="jar__twine"></span></div>
          </div>
        </div>
        <p class="jar-count">
          ${
            slips.length
              ? `<b>${slips.length}</b> ${slips.length === 1 ? "reason" : "reasons"} inside${unread.length ? ` · <b>${unread.length}</b> from ${UI.escape(other().displayName)} you haven't read` : ""}`
              : "The jar is waiting for its first reason."
          }
        </p>
        <div class="jar-actions">
          <button type="button" class="btn btn--primary" id="jar-pick" ${forMe.length ? "" : "disabled"}>${UI.icon("jar")} Pick one</button>
          <button type="button" class="btn btn--ghost" id="jar-add">${UI.icon("plus")} Add a reason</button>
        </div>
        ${forMe.length ? "" : `<p class="jar-hint">When ${UI.escape(other().displayName)} adds reasons, you can pick them out here.</p>`}
        ${mineListHtml()}
      </div>`;
  }

  function mineListHtml() {
    const mine = Storage.getJar().filter((s) => s.from === me().id).reverse();
    if (!mine.length) return "";
    return `
      <details class="jar-mine">
        <summary>Reasons you've added <span>${mine.length}</span></summary>
        <ul>
          ${mine
            .map(
              (s) => `
            <li>
              <span>${UI.escape(s.text)}</span>
              <span class="jar-mine__meta">${(s.readBy || []).length ? "read" : "unread"}</span>
              <button type="button" class="icon-btn icon-btn--sm" data-remove-slip="${UI.escape(s.id)}" aria-label="Take this reason out">${UI.icon("close")}</button>
            </li>`
            )
            .join("")}
        </ul>
      </details>`;
  }

  function bindJar(panel, refresh) {
    const scene = panel.querySelector("#jar-scene");
    const jar = panel.querySelector("#jar");

    // Tilt the jar toward the pointer / finger for real parallax.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      const move = (x, y) => {
        const r = scene.getBoundingClientRect();
        const px = Math.max(-1, Math.min(1, ((x - r.left) / r.width) * 2 - 1));
        const py = Math.max(-1, Math.min(1, ((y - r.top) / r.height) * 2 - 1));
        jar.style.setProperty("--ry", `${px * 22}deg`);
        jar.style.setProperty("--rx", `${-py * 8}deg`);
      };
      scene.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
      scene.addEventListener("pointerleave", () => {
        jar.style.setProperty("--ry", "0deg");
        jar.style.setProperty("--rx", "0deg");
      });
    }

    panel.querySelector("#jar-add").addEventListener("click", () => openReasonComposer(refresh));
    panel.querySelector("#jar-pick").addEventListener("click", () => pickSlip(panel, refresh));
    panel.querySelectorAll("[data-remove-slip]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ok = await UI.confirm({ title: "Take this reason out?", confirmLabel: "Take it out", danger: true });
        if (!ok) return;
        Storage.setJar(Storage.getJar().filter((s) => s.id !== btn.dataset.removeSlip));
        refresh();
      })
    );
  }

  function openReasonComposer(refresh) {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Add a reason",
      content: `
        <h2 class="modal__title">A reason for <em>${UI.escape(other().displayName)}</em></h2>
        <form class="form" id="reason-form" novalidate>
          <label class="field">
            <span class="field__label">Why you love them</span>
            <textarea class="field__input field__input--area slip-input" name="text" rows="4" maxlength="280" placeholder="${UI.escape(prompt)}" autofocus></textarea>
            <span class="field__hint">Small and specific is perfect. They'll pick it out on a day they need it.</span>
          </label>
          <p class="form__error" id="reason-error" role="alert" hidden></p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Fold it into the jar</button>
          </div>
        </form>`,
    });
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    panel.querySelector("#reason-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = String(new FormData(e.target).get("text") || "").trim();
      if (!text) {
        const err = panel.querySelector("#reason-error");
        err.textContent = "Write a few words first.";
        err.hidden = false;
        return;
      }
      const id = UI.uid("slip");
      Storage.setJar([...Storage.getJar(), { id, from: me().id, text, ts: Date.now(), readBy: [] }]);
      UI.closeModal();
      freshSlip = id;
      refresh();
      Toast.show("Folded into the jar ❤️");
    });
  }

  let freshSlip = null;

  function pickSlip(panel, refresh) {
    const forMe = slipsFor(me().id);
    if (!forMe.length) return;
    const unread = forMe.filter((s) => !(s.readBy || []).includes(me().id));
    const pool = unread.length ? unread : forMe;
    const slip = pool[Math.floor(Math.random() * pool.length)];
    const jar = panel.querySelector("#jar");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    jar.classList.remove("jar--shake");
    void jar.offsetWidth;
    jar.classList.add("jar--shake");
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);

    // A slip rises out of the jar toward you, then unfolds.
    const rect = jar.getBoundingClientRect();
    const flyer = document.createElement("span");
    flyer.className = "slip-flyer";
    flyer.style.left = `${rect.left + rect.width / 2}px`;
    flyer.style.top = `${rect.top + rect.height * 0.45}px`;
    flyer.style.setProperty("--c", SLIP_COLOURS[Math.floor(hash(slip.id + "x") * SLIP_COLOURS.length)]);
    document.body.appendChild(flyer);

    setTimeout(() => {
      flyer.remove();
      showSlip(slip, refresh);
    }, reduce ? 0 : 1050);

    if (!(slip.readBy || []).includes(me().id)) {
      Storage.setJar(Storage.getJar().map((s) => (s.id === slip.id ? { ...s, readBy: [...(s.readBy || []), me().id] } : s)));
    }
  }

  function showSlip(slip, refresh) {
    const date = new Date(slip.ts).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    const panel = UI.openModal({
      variant: "modal__panel--slip",
      label: "A reason from the jar",
      onClose: refresh,
      content: `
        <div class="unfold">
          <div class="unfold__top">
            <span class="seal unfold__seal" aria-hidden="true"></span>
            <span class="unfold__from">from the jar</span>
            <span class="unfold__crease"></span>
          </div>
          <div class="unfold__bottom">
            <p class="unfold__text">${UI.escape(slip.text)}</p>
            <p class="unfold__sign">${UI.escape(CONFIG.users[slip.from]?.displayName || "")}</p>
            <p class="unfold__date">${date}</p>
          </div>
        </div>
        <div class="modal__actions modal__actions--center">
          <button type="button" class="btn btn--ghost" data-again>${UI.icon("jar")} Another</button>
          <button type="button" class="btn btn--primary" data-close-modal>Keep it close</button>
        </div>`,
    });
    panel.querySelector("[data-again]").addEventListener("click", () => {
      UI.closeModal();
      setTimeout(() => {
        const host = document.querySelector(".together-panel");
        if (host) pickSlip(host, refresh);
      }, 220);
    });
  }

  // =================================================================
  // TIME CAPSULES
  // =================================================================
  function nextAnniversaryIso() {
    const start = UI.parseLocalDate(Storage.getStartDate());
    const today = UI.startOfDay(new Date());
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (next <= today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return UI.toInputDate(next);
  }

  function addMonths(months) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return UI.toInputDate(d);
  }

  function capsuleState(c) {
    const opens = UI.parseLocalDate(c.openOn);
    const days = UI.daysBetween(new Date(), opens);
    if ((c.openedBy || []).includes(me().id)) return { key: "opened", label: "Opened", days };
    if (days <= 0) return { key: "ready", label: "Ready to open", days };
    return { key: "sealed", label: days === 1 ? "Opens tomorrow" : `Opens in ${days} days`, days };
  }

  function capsuleCubeHtml(c, i) {
    const st = capsuleState(c);
    const hue = ["#7a2439", "#2f4a6b", "#5e6b3a", "#8a5a2b"][Math.floor(hash(c.id) * 4)];
    return `
      <button type="button" class="capsule capsule--${st.key}" data-capsule="${UI.escape(c.id)}" style="--box:${hue};--delay:${(i % 5) * -1.3}s" aria-label="${UI.escape(c.title)}, ${UI.escape(st.label)}">
        <span class="cube">
          <span class="cube__face cube__face--front"><span class="seal cube__seal"></span><span class="cube__tag">${UI.escape(UI.formatLongDate(c.openOn))}</span></span>
          <span class="cube__face cube__face--back"></span>
          <span class="cube__face cube__face--left"></span>
          <span class="cube__face cube__face--right"></span>
          <span class="cube__face cube__face--bottom"></span>
          <span class="cube__lid"><span class="cube__face cube__face--top"></span><span class="cube__lid-front"></span></span>
          <span class="cube__glow"></span>
        </span>
        <span class="capsule__shadow"></span>
        <span class="capsule__title">${UI.escape(c.title)}</span>
        <span class="capsule__state">${st.key === "ready" ? "✨ " : ""}${UI.escape(st.label)}</span>
        <span class="capsule__from">from ${UI.escape(nameOf(c.from))}</span>
      </button>`;
  }

  function capsulesHtml() {
    const list = Storage.getCapsules();
    const shelf = (items) => `<div class="shelf">${items.map(capsuleCubeHtml).join("")}</div><div class="shelf__plank"></div>`;
    const sealed = list.filter((c) => capsuleState(c).key !== "opened");
    const opened = list.filter((c) => capsuleState(c).key === "opened");
    return `
      <div class="capsules">
        <div class="capsules__intro">
          <p>Seal a letter for a day that hasn't happened yet. Neither of you can open it until then.</p>
          <button type="button" class="btn btn--primary" id="capsule-new">${UI.icon("capsule")} Seal a capsule</button>
        </div>
        ${
          sealed.length
            ? shelf(sealed)
            : `<div class="empty-state empty-state--card"><div class="empty-state__icon">${UI.icon("capsule")}</div><p class="empty-state__title">No capsules on the shelf yet.</p><p class="empty-state__subtitle">Try one for your next anniversary.</p></div>`
        }
        ${opened.length ? `<h3 class="capsules__sub">Opened</h3>${shelf(opened)}` : ""}
      </div>`;
  }

  function openCapsuleComposer(refresh) {
    const tomorrow = UI.toInputDate(new Date(Date.now() + UI.DAY));
    const presets = [
      ["Next anniversary", nextAnniversaryIso()],
      ["In 6 months", addMonths(6)],
      ["In a year", addMonths(12)],
      ["In 5 years", addMonths(60)],
    ];
    let photo = null;
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Seal a time capsule",
      content: `
        <h2 class="modal__title">Seal a <em>time capsule</em></h2>
        <form class="form" id="capsule-form" novalidate>
          <label class="field">
            <span class="field__label">Give it a name</span>
            <input class="field__input" name="title" maxlength="60" placeholder="For our third anniversary" autofocus />
          </label>
          <label class="field">
            <span class="field__label">Your letter</span>
            <textarea class="field__input field__input--area" name="message" rows="6" maxlength="4000" placeholder="Dear future us…"></textarea>
          </label>
          <label class="photo-drop photo-drop--small">
            <input type="file" accept="image/*" class="visually-hidden" name="photo" />
            <span class="photo-drop__empty">${UI.icon("image")}<span class="photo-drop__title">Add a photo</span><span class="photo-drop__hint">Optional</span></span>
            <span class="photo-drop__preview" hidden></span>
          </label>
          <fieldset class="field">
            <legend class="field__label">Opens on</legend>
            <div class="chips">
              ${presets.map(([label, date], i) => `<button type="button" class="chip ${i === 0 ? "chip--on" : ""}" data-date="${date}">${label}</button>`).join("")}
            </div>
            <input class="field__input" type="date" name="openOn" min="${tomorrow}" value="${presets[0][1]}" />
          </fieldset>
          <p class="form__error" id="capsule-error" role="alert" hidden></p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Seal it</button>
          </div>
        </form>`,
    });
    const form = panel.querySelector("#capsule-form");
    const dateInput = form.querySelector('[name="openOn"]');
    const error = panel.querySelector("#capsule-error");
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    form.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        form.querySelectorAll(".chip").forEach((c) => c.classList.toggle("chip--on", c === chip));
        dateInput.value = chip.dataset.date;
      })
    );
    dateInput.addEventListener("input", () => form.querySelectorAll(".chip").forEach((c) => c.classList.toggle("chip--on", c.dataset.date === dateInput.value)));
    form.querySelector('[name="photo"]').addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        photo = await UI.readImage(file, { maxSize: 1200, quality: 0.8 });
        const prev = form.querySelector(".photo-drop__preview");
        prev.style.backgroundImage = `url('${photo}')`;
        prev.hidden = false;
        form.querySelector(".photo-drop__empty").hidden = true;
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      const message = String(data.get("message") || "").trim();
      const openOn = String(data.get("openOn") || "");
      let problem = "";
      if (!title) problem = "Give your capsule a name.";
      else if (!message) problem = "Write your letter first.";
      else if (!openOn || openOn < tomorrow) problem = "Choose a day from tomorrow onwards.";
      if (problem) {
        error.textContent = problem;
        error.hidden = false;
        return;
      }
      const capsule = { id: UI.uid("cap"), from: me().id, title, message, openOn, ts: Date.now(), openedBy: [] };
      if (photo) capsule.photo = photo;
      Storage.setCapsules([...Storage.getCapsules(), capsule]);
      UI.closeModal();
      refresh();
      Toast.show(`Sealed until ${UI.formatLongDate(openOn)} ❤️`);
    });
  }

  function readCapsule(c) {
    const sealedOn = new Date(c.ts).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    UI.openModal({
      variant: "modal__panel--note",
      label: c.title,
      content: `
        <p class="note-reader__eyebrow">Sealed ${sealedOn} · opened ${UI.formatLongDate(c.openOn)}</p>
        <h2 class="note-reader__title">${UI.escape(c.title)}</h2>
        ${c.photo ? `<img class="capsule-photo" src="${UI.escape(c.photo)}" alt="Photo sealed in the capsule" />` : ""}
        <p class="note-reader__message">${UI.escape(c.message)}</p>
        <p class="note-reader__sign">${UI.escape(CONFIG.users[c.from]?.displayName || "")}</p>`,
    });
  }

  function openingScene(c, done) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return done();
    const hue = ["#7a2439", "#2f4a6b", "#5e6b3a", "#8a5a2b"][Math.floor(hash(c.id) * 4)];
    const el = document.createElement("div");
    el.className = "opening";
    el.innerHTML = `
      <div class="opening__light"></div>
      <span class="cube cube--big" style="--box:${hue}">
        <span class="cube__face cube__face--front"><span class="seal cube__seal"></span></span>
        <span class="cube__face cube__face--back"></span>
        <span class="cube__face cube__face--left"></span>
        <span class="cube__face cube__face--right"></span>
        <span class="cube__face cube__face--bottom"></span>
        <span class="cube__lid"><span class="cube__face cube__face--top"></span><span class="cube__lid-front"></span></span>
        <span class="cube__glow"></span>
        <span class="opening__letter"></span>
      </span>
      <p class="opening__text">${UI.escape(c.title)}</p>`;
    document.body.appendChild(el);
    if (navigator.vibrate) navigator.vibrate(30);
    requestAnimationFrame(() => el.classList.add("opening--go"));
    setTimeout(() => {
      el.classList.add("opening--leaving");
      done();
      setTimeout(() => el.remove(), 500);
    }, 2300);
  }

  function bindCapsules(panel, refresh) {
    panel.querySelector("#capsule-new").addEventListener("click", () => openCapsuleComposer(refresh));
    panel.querySelectorAll("[data-capsule]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const c = Storage.getCapsules().find((x) => x.id === btn.dataset.capsule);
        if (!c) return;
        const st = capsuleState(c);
        if (st.key === "opened") return readCapsule(c);
        if (st.key === "ready") {
          openingScene(c, () => {
            Storage.setCapsules(Storage.getCapsules().map((x) => (x.id === c.id ? { ...x, openedBy: [...(x.openedBy || []), me().id] } : x)));
            readCapsule(c);
            refresh();
          });
          return;
        }
        const mine = c.from === me().id;
        const p = UI.openModal({
          variant: "modal__panel--small",
          label: "Still sealed",
          content: `
            <div class="seal seal--lg seal--modal" aria-hidden="true"></div>
            <h2 class="modal__title">${UI.escape(c.title)}</h2>
            <p class="modal__panel-text">Sealed by ${UI.escape(nameOf(c.from))}. ${UI.escape(st.label)}, on ${UI.formatLongDate(c.openOn)}.</p>
            <div class="modal__actions">
              ${mine ? `<button type="button" class="btn btn--ghost" data-del>Delete</button>` : ""}
              <button type="button" class="btn btn--primary" data-close-modal>I'll wait</button>
            </div>`,
        });
        const del = p.querySelector("[data-del]");
        if (del)
          del.addEventListener("click", async () => {
            UI.closeModal();
            const ok = await UI.confirm({ title: "Delete this capsule?", message: "It hasn't been opened yet. This can't be undone.", confirmLabel: "Delete", danger: true });
            if (!ok) return;
            Storage.setCapsules(Storage.getCapsules().filter((x) => x.id !== c.id));
            refresh();
          });
      })
    );
  }

  // =================================================================
  // SHARED LISTS
  // =================================================================
  const PRESETS = [
    { title: "Bucket list", emoji: "🌍" },
    { title: "Date ideas", emoji: "🕯️" },
    { title: "Films to watch", emoji: "🎬" },
    { title: "Places to go", emoji: "✈️" },
    { title: "Recipes to try", emoji: "🍝" },
  ];

  function listsHtml() {
    const lists = Storage.getLists();
    const items = Storage.getListItems();
    const unused = PRESETS.filter((p) => !lists.some((l) => l.title === p.title));
    const cards = lists
      .map((l, i) => {
        const its = items.filter((it) => it.listId === l.id);
        const done = its.filter((it) => it.done).length;
        const open = its.filter((it) => !it.done);
        const finished = its.filter((it) => it.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
        const row = (it) => `
          <li class="item ${it.done ? "item--done" : ""}" data-item="${UI.escape(it.id)}">
            <button type="button" class="item__check" data-toggle aria-pressed="${it.done}" aria-label="${it.done ? "Mark not done" : "Mark done"}: ${UI.escape(it.text)}">${UI.icon("check")}</button>
            <span class="item__body">
              <span class="item__text">${UI.escape(it.text)}</span>
              ${it.done ? `<span class="item__meta">done by ${UI.escape(nameOf(it.doneBy))} · ${new Date(it.doneAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>` : ""}
            </span>
            <button type="button" class="icon-btn icon-btn--sm item__remove" data-remove-item aria-label="Remove ${UI.escape(it.text)}">${UI.icon("close")}</button>
          </li>`;
        return `
          <article class="card-list" data-list="${UI.escape(l.id)}" style="--i:${i}">
            <header class="card-list__head">
              <span class="card-list__emoji" aria-hidden="true">${UI.escape(l.emoji || "♡")}</span>
              <h3 class="card-list__title">${UI.escape(l.title)}</h3>
              <span class="card-list__count">${done}/${its.length}</span>
              <button type="button" class="icon-btn icon-btn--sm" data-delete-list aria-label="Delete ${UI.escape(l.title)}">${UI.icon("trash")}</button>
            </header>
            <div class="card-list__bar"><span style="width:${its.length ? (done / its.length) * 100 : 0}%"></span></div>
            <ul class="card-list__items">
              ${open.map(row).join("")}
              ${finished.map(row).join("")}
            </ul>
            <form class="card-list__add" data-add-form>
              <span class="card-list__plus" aria-hidden="true">${UI.icon("plus")}</span>
              <input class="card-list__input" name="text" maxlength="120" placeholder="Add to ${UI.escape(l.title.toLowerCase())}…" autocomplete="off" enterkeyhint="done" aria-label="Add to ${UI.escape(l.title)}" />
            </form>
          </article>`;
      })
      .join("");
    return `
      <div class="lists">
        ${cards || `<div class="empty-state empty-state--card"><div class="empty-state__icon">${UI.icon("list")}</div><p class="empty-state__title">Start a list together.</p><p class="empty-state__subtitle">Pick one below, or make your own.</p></div>`}
        <div class="lists__new">
          <p class="lists__new-label">${lists.length ? "Start another list" : "Start with"}</p>
          <div class="chips">
            ${unused.map((p) => `<button type="button" class="chip" data-preset="${UI.escape(p.title)}">${p.emoji} ${UI.escape(p.title)}</button>`).join("")}
            <button type="button" class="chip chip--ghost" data-custom-list>${UI.icon("plus")} Your own</button>
          </div>
        </div>
      </div>`;
  }

  function createList(title, emoji) {
    const list = { id: UI.uid("list"), title, emoji, ts: Date.now(), by: me().id };
    Storage.setLists([...Storage.getLists(), list]);
    return list;
  }

  function bindLists(panel, refresh) {
    panel.querySelectorAll("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = PRESETS.find((x) => x.title === b.dataset.preset);
        const list = createList(p.title, p.emoji);
        refresh();
        const input = document.querySelector(`[data-list="${CSS.escape(list.id)}"] .card-list__input`);
        if (input) input.focus({ preventScroll: false });
      })
    );
    panel.querySelector("[data-custom-list]").addEventListener("click", () => {
      const p = UI.openModal({
        variant: "modal__panel--form",
        label: "New list",
        content: `
          <h2 class="modal__title">A new <em>list</em></h2>
          <form class="form" id="list-form" novalidate>
            <div class="field-row field-row--emoji">
              <label class="field"><span class="field__label">Emoji</span><input class="field__input" name="emoji" maxlength="4" value="♡" /></label>
              <label class="field"><span class="field__label">Name</span><input class="field__input" name="title" maxlength="40" placeholder="Things to cook together" autofocus /></label>
            </div>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
              <button type="submit" class="btn btn--primary">Create</button>
            </div>
          </form>`,
      });
      p.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
      p.querySelector("#list-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const d = new FormData(e.target);
        const title = String(d.get("title") || "").trim();
        if (!title) return;
        createList(title, String(d.get("emoji") || "♡").trim() || "♡");
        UI.closeModal();
        refresh();
      });
    });

    panel.querySelectorAll("[data-list]").forEach((card) => {
      const listId = card.dataset.list;
      card.querySelector("[data-add-form]").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = e.target.querySelector("input");
        const text = input.value.trim();
        if (!text) return;
        Storage.setListItems([...Storage.getListItems(), { id: UI.uid("it"), listId, text, done: false, by: me().id, ts: Date.now() }]);
        refresh({ focusList: listId });
      });
      card.querySelector("[data-delete-list]").addEventListener("click", async () => {
        const list = Storage.getLists().find((l) => l.id === listId);
        const ok = await UI.confirm({ title: `Delete “${list.title}”?`, message: "The list and everything on it will be gone for both of you.", confirmLabel: "Delete", danger: true });
        if (!ok) return;
        Storage.setListItems(Storage.getListItems().filter((it) => it.listId !== listId));
        Storage.setLists(Storage.getLists().filter((l) => l.id !== listId));
        refresh();
      });
      card.querySelector(".card-list__items").addEventListener("click", (e) => {
        const li = e.target.closest("[data-item]");
        if (!li) return;
        const id = li.dataset.item;
        if (e.target.closest("[data-remove-item]")) {
          Storage.setListItems(Storage.getListItems().filter((it) => it.id !== id));
          refresh();
          return;
        }
        if (e.target.closest("[data-toggle]") || e.target.closest(".item__text")) {
          const item = Storage.getListItems().find((it) => it.id === id);
          const done = !item.done;
          Storage.setListItems(
            Storage.getListItems().map((it) => (it.id === id ? { ...it, done, doneBy: done ? me().id : null, doneAt: done ? Date.now() : null } : it))
          );
          if (done) {
            li.classList.add("item--ticking");
            UI.burstHearts(li.querySelector(".item__check"));
            if (navigator.vibrate) navigator.vibrate(12);
            setTimeout(() => refresh(), 650);
          } else refresh();
        }
      });
    });
  }

  // =================================================================
  // Page
  // =================================================================
  const TABS = [
    { id: "jar", label: "Love jar", icon: "jar" },
    { id: "capsules", label: "Time capsules", icon: "capsule" },
    { id: "lists", label: "Lists", icon: "list" },
  ];

  function render(root) {
    root.innerHTML = `
      <section class="together-view">
        <header class="page-header">
          <h1 class="page-header__title"><em>Together</em></h1>
          <p class="page-header__subtitle">Little rituals, kept between the two of you.</p>
        </header>
        <div class="together-tabs" role="tablist" aria-label="Together">
          ${TABS.map((t) => `<button type="button" class="together-tab" role="tab" data-tab="${t.id}">${UI.icon(t.icon)}<span>${t.label}</span></button>`).join("")}
        </div>
        <div class="together-panel" role="tabpanel"></div>
      </section>`;

    const panel = root.querySelector(".together-panel");

    function refresh(opts = {}) {
      if (!document.contains(panel)) return;
      root.querySelectorAll("[data-tab]").forEach((t) => {
        const on = t.dataset.tab === tab;
        t.classList.toggle("together-tab--on", on);
        t.setAttribute("aria-selected", String(on));
      });
      panel.dataset.tab = tab;
      if (tab === "jar") {
        panel.innerHTML = jarHtml(freshSlip);
        freshSlip = null;
        bindJar(panel, refresh);
      } else if (tab === "capsules") {
        panel.innerHTML = capsulesHtml();
        bindCapsules(panel, refresh);
      } else {
        panel.innerHTML = listsHtml();
        bindLists(panel, refresh);
        if (opts.focusList) {
          const input = panel.querySelector(`[data-list="${CSS.escape(opts.focusList)}"] .card-list__input`);
          if (input) input.focus({ preventScroll: true });
        }
      }
    }

    root.querySelectorAll("[data-tab]").forEach((t) =>
      t.addEventListener("click", () => {
        tab = t.dataset.tab;
        try {
          localStorage.setItem("ourspace_together_tab", tab);
        } catch {}
        refresh();
      })
    );
    refresh();
  }

  return { render };
})();

Router.register("together", Together.render);
