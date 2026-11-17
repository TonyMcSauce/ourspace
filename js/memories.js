/**
 * memories.js
 * Photo/memory gallery.
 *
 * Memory shape:
 *   { id, title, date (YYYY-MM-DD, or a legacy free-text label),
 *     caption, image?: dataURL, gradient?: css, addedBy?, addedAt? }
 *
 * In V1, photos are downscaled in the browser and kept in local
 * storage. In V2 `image` becomes a Firebase Storage URL.
 */

const Memories = (() => {
  const GRADIENTS = [
    "linear-gradient(135deg, #7a2439, #c98a9c)",
    "linear-gradient(135deg, #3a2036, #8a5a6b)",
    "linear-gradient(135deg, #5c1f2e, #e0a5ab)",
    "linear-gradient(135deg, #2b1b2e, #a15c6e)",
    "linear-gradient(135deg, #6b2337, #d99aa5)",
    "linear-gradient(135deg, #451826, #b97684)",
  ];

  function seedMemories() {
    return [
      { id: "mem6", title: "Sunday breakfast", date: "2026-02-08", caption: "You burnt the pancakes. I still ate three.", gradient: GRADIENTS[5] },
      { id: "mem2", title: "Random Sunday", date: "2026-01-18", caption: "No plans, just us and bad reality TV.", gradient: GRADIENTS[1] },
      { id: "mem4", title: "One of my favourite days", date: "2025-10-11", caption: "Nothing special happened. That's why it was special.", gradient: GRADIENTS[3] },
      { id: "mem5", title: "Late night drive", date: "2025-08-22", caption: "Windows down, your playlist, no destination.", gradient: GRADIENTS[4] },
      { id: "mem3", title: "Our first trip", date: "2025-06-14", caption: "Got lost twice, laughed the whole time.", gradient: GRADIENTS[2] },
      { id: "mem1", title: "That weekend ❤️", date: "2025-03-15", caption: "We didn't leave the couch once and it was perfect.", gradient: GRADIENTS[0] },
    ];
  }

  function loadMemories() {
    let memories = Storage.getMemories();
    if (!Array.isArray(memories)) {
      memories = seedMemories();
      Storage.setMemories(memories);
    }
    return memories;
  }

  function sorted(memories) {
    // ISO-dated memories sort newest first; legacy free-text dates keep
    // their original relative order after them.
    return memories
      .map((m, i) => ({ m, i }))
      .sort((a, b) => {
        const ad = UI.isIsoDate(a.m.date), bd = UI.isIsoDate(b.m.date);
        if (ad && bd) return b.m.date.localeCompare(a.m.date) || a.i - b.i;
        if (ad !== bd) return ad ? -1 : 1;
        return a.i - b.i;
      })
      .map(({ m }) => m);
  }

  function saveMemories(memories) {
    const ok = Storage.setMemories(memories);
    if (!ok) Toast.show("Couldn't save, the device storage is full. Try a smaller photo.");
    return ok;
  }

  function visual(mem) {
    if (mem.image) return `background-image:url('${mem.image.replace(/'/g, "%27")}')`;
    return `background:${mem.gradient || GRADIENTS[0]}`;
  }

  function cardHtml(mem, index) {
    const tilt = [-2.2, 1.6, -1, 2.4, -1.8, 0.8, 1.9, -2.6][index % 8];
    return `
      <button type="button" class="polaroid" data-memory-id="${UI.escape(mem.id)}"
        style="--tilt:${tilt}deg;animation-delay:${Math.min(index, 10) * 55}ms" aria-label="${UI.escape(mem.title)}, ${UI.escape(UI.formatMonthYear(mem.date))}">
        <span class="polaroid__tape" aria-hidden="true"></span>
        <span class="polaroid__photo" style="${visual(mem)}"></span>
        <span class="polaroid__caption">${UI.escape(mem.title)}</span>
        <span class="polaroid__date">${UI.escape(UI.formatMonthYear(mem.date))}</span>
      </button>
    `;
  }

  function addTileHtml() {
    return `
      <button type="button" class="polaroid polaroid--add" id="add-memory-tile" style="--tilt:-1.2deg">
        <span class="polaroid__photo polaroid__photo--empty">${UI.icon("plus")}</span>
        <span class="polaroid__caption">Add a memory</span>
        <span class="polaroid__date">whenever you like</span>
      </button>
    `;
  }

  // ---------------------------------------------------------------
  // Viewer with prev/next
  // ---------------------------------------------------------------
  function openViewer(list, startIndex, onChange) {
    let index = startIndex;

    function body() {
      const mem = list[index];
      return `
        <div class="viewer__stage">
          <div class="viewer__image ${mem.image ? "viewer__image--photo" : ""}" style="${visual(mem)}" role="img" aria-label="${UI.escape(mem.title)}"></div>
          ${list.length > 1 ? `
            <button type="button" class="viewer__nav viewer__nav--prev" data-step="-1" aria-label="Previous memory">${UI.icon("chevronLeft")}</button>
            <button type="button" class="viewer__nav viewer__nav--next" data-step="1" aria-label="Next memory">${UI.icon("chevronRight")}</button>` : ""}
        </div>
        <div class="viewer__body">
          <p class="viewer__date">${UI.escape(UI.formatMonthYear(mem.date))}${list.length > 1 ? ` · ${index + 1} of ${list.length}` : ""}</p>
          <h2 class="viewer__title">${UI.escape(mem.title)}</h2>
          ${mem.caption ? `<p class="viewer__caption">${UI.escape(mem.caption)}</p>` : ""}
          <div class="modal__actions modal__actions--start">
            <button type="button" class="btn btn--text btn--text-danger" data-delete>${UI.icon("trash")} Remove</button>
          </div>
        </div>
      `;
    }

    const panel = UI.openModal({
      variant: "modal__panel--memory",
      label: "Memory",
      content: `<div class="viewer" id="viewer"></div>`,
      onKey: (e) => {
        if (e.key === "ArrowLeft") step(-1);
        if (e.key === "ArrowRight") step(1);
      },
    });
    const host = panel.querySelector("#viewer");

    function paint() {
      host.innerHTML = body();
    }
    function step(delta) {
      if (list.length < 2) return;
      index = (index + delta + list.length) % list.length;
      paint();
    }

    host.addEventListener("click", async (e) => {
      const nav = e.target.closest("[data-step]");
      if (nav) {
        step(Number(nav.dataset.step));
        return;
      }
      if (e.target.closest("[data-delete]")) {
        const mem = list[index];
        UI.closeModal();
        const ok = await UI.confirm({
          title: "Remove this memory?",
          message: `“${mem.title}” will be removed for both of you.`,
          confirmLabel: "Remove",
          danger: true,
        });
        if (!ok) return;
        saveMemories(loadMemories().filter((m) => m.id !== mem.id));
        onChange();
        Toast.show("Memory removed.");
      }
    });

    // Swipe left/right on touch screens.
    let touchX = null;
    host.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
    host.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });

    paint();
  }

  // ---------------------------------------------------------------
  // Adding
  // ---------------------------------------------------------------
  function openComposer(onChange) {
    let imageData = null;
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Add a memory",
      content: `
        <h2 class="modal__title">Add a memory</h2>
        <form class="form" id="memory-form" novalidate>
          <label class="photo-drop" id="photo-drop">
            <input type="file" accept="image/*" name="photo" class="visually-hidden" />
            <span class="photo-drop__empty">
              ${UI.icon("image")}
              <span class="photo-drop__title">Choose a photo</span>
              <span class="photo-drop__hint">Optional. We'll use a soft colour if you skip it.</span>
            </span>
            <span class="photo-drop__preview" hidden></span>
          </label>
          <label class="field">
            <span class="field__label">Title</span>
            <input class="field__input" name="title" maxlength="70" placeholder="That rainy afternoon" required />
          </label>
          <label class="field">
            <span class="field__label">When</span>
            <input class="field__input" type="date" name="date" value="${UI.toInputDate(new Date())}" max="${UI.toInputDate(new Date())}" required />
          </label>
          <label class="field">
            <span class="field__label">A few words</span>
            <textarea class="field__input field__input--area" name="caption" rows="3" maxlength="400" placeholder="What made it special?"></textarea>
          </label>
          <p class="form__error" id="memory-error" role="alert" hidden></p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Save memory</button>
          </div>
        </form>
      `,
    });

    const form = panel.querySelector("#memory-form");
    const fileInput = form.querySelector('input[type="file"]');
    const preview = form.querySelector(".photo-drop__preview");
    const empty = form.querySelector(".photo-drop__empty");
    const error = form.querySelector("#memory-error");
    const submit = form.querySelector('button[type="submit"]');
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    requestAnimationFrame(() => form.querySelector('[name="title"]').focus({ preventScroll: true }));

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      submit.disabled = true;
      try {
        imageData = await UI.readImage(file, { maxSize: 1400, quality: 0.82 });
        preview.style.backgroundImage = `url('${imageData}')`;
        preview.hidden = false;
        empty.hidden = true;
        error.hidden = true;
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      const date = String(data.get("date") || "");
      if (!title || !date) {
        error.textContent = !title ? "Give this memory a title." : "When did it happen?";
        error.hidden = false;
        return;
      }
      const memory = {
        id: UI.uid("mem"),
        title,
        date,
        caption: String(data.get("caption") || "").trim(),
        image: imageData || undefined,
        gradient: imageData ? undefined : GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
        addedBy: Auth.currentUser().id,
        addedAt: Date.now(),
      };
      if (!saveMemories([memory, ...loadMemories()])) return;
      UI.closeModal();
      onChange();
      Toast.show("Memory saved ❤️");
    });
  }

  // ---------------------------------------------------------------
  function render(root) {
    root.innerHTML = `
      <section class="memories-view">
        <header class="page-header page-header--with-action">
          <div>
            <h1 class="page-header__title"><em>Memories</em></h1>
            <p class="page-header__subtitle" id="memories-count">Little moments worth keeping.</p>
          </div>
          <button type="button" class="btn btn--primary btn--icon-text" id="add-memory-btn">${UI.icon("plus")}<span>Add</span></button>
        </header>
        <div class="memories-grid"></div>
      </section>
    `;

    const grid = root.querySelector(".memories-grid");
    let list = [];

    function refresh() {
      list = sorted(loadMemories());
      grid.innerHTML = addTileHtml() + list.map(cardHtml).join("");
      const count = root.querySelector("#memories-count");
      count.textContent = list.length
        ? `${list.length} ${list.length === 1 ? "moment" : "moments"}, kept.`
        : "Little moments worth keeping.";
    }
    refresh();

    root.querySelector("#add-memory-btn").addEventListener("click", () => openComposer(refresh));
    grid.addEventListener("click", (e) => {
      if (e.target.closest("#add-memory-tile")) {
        openComposer(refresh);
        return;
      }
      const card = e.target.closest("[data-memory-id]");
      if (!card) return;
      const idx = list.findIndex((m) => m.id === card.dataset.memoryId);
      if (idx >= 0) openViewer(list, idx, refresh);
    });
  }

  return { render, loadMemories };
})();

Router.register("memories", Memories.render);
