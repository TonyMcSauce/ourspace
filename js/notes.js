/**
 * notes.js
 * Love Notes: short cards separate from the chat stream.
 *
 * Note shape:
 *   { id, title, message, author, date (ms), locked, unlockDate (YYYY-MM-DD|null) }
 *
 * Sealing works two ways:
 *   - "Open when…" notes: locked with no unlockDate. The reader chooses
 *     the moment, and opening one is permanent.
 *   - Dated notes: locked until unlockDate, then open automatically.
 */

const Notes = (() => {
  let filter = "all";

  function seedNotes() {
    const now = Date.now();
    const day = UI.DAY;
    return [
      {
        id: "n1",
        title: "Just because",
        message: "Just a reminder that I'm proud of you. Not for anything specific, just for being you, today, doing your best.",
        author: "tony",
        date: now - 2 * day,
        locked: false,
        unlockDate: null,
      },
      {
        id: "n2",
        title: "For the hard days",
        message: "For when you're having a bad day ❤️. Read this, take a breath, and remember it's temporary. I've got you.",
        author: "tony",
        date: now - 6 * day,
        locked: false,
        unlockDate: null,
      },
      {
        id: "n3",
        title: "Open when you need a little extra love",
        message: "If you're reading this, today asked a lot of you. Here's your reminder that you are so loved, exactly as you are. Call me. I'll drop everything.",
        author: "babegirl",
        date: now - 1 * day,
        locked: true,
        unlockDate: null,
      },
      {
        id: "n4",
        title: "Random Tuesday thoughts",
        message: "I was just thinking about you and smiled at nothing in the middle of a meeting. Worth it.",
        author: "babegirl",
        date: now - 10 * day,
        locked: false,
        unlockDate: null,
      },
      {
        id: "n5",
        title: "For our next anniversary",
        message: "Happy anniversary, my love. Another year of choosing each other. Here's to all the ones still ahead of us.",
        author: "tony",
        date: now - 3 * day,
        locked: true,
        unlockDate: nextAnniversaryIso(),
      },
    ];
  }

  function nextAnniversaryIso() {
    const start = UI.parseLocalDate(Storage.getStartDate());
    const today = UI.startOfDay(new Date());
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (next <= today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return UI.toInputDate(next);
  }

  function loadNotes() {
    let notes = Storage.getNotes();
    if (!Array.isArray(notes)) {
      notes = seedNotes();
      Storage.setNotes(notes);
    }
    return notes;
  }

  function saveNotes(notes) {
    const ok = Storage.setNotes(notes);
    if (!ok) Toast.show("Couldn't save that note, the device storage is full.");
    return ok;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  /** "open" | "sealed-dated" | "sealed-open-when" */
  function stateOf(note) {
    if (!note.locked) return "open";
    if (note.unlockDate) {
      const unlock = UI.parseLocalDate(note.unlockDate);
      if (unlock && unlock <= new Date()) return "open";
      return "sealed-dated";
    }
    return "sealed-open-when";
  }

  function countdown(unlockDate) {
    const days = UI.daysBetween(new Date(), UI.parseLocalDate(unlockDate));
    if (days <= 1) return "Opens tomorrow";
    return `Opens in ${days} days`;
  }

  function authorName(id) {
    return CONFIG.users[id]?.displayName || id;
  }

  function cardHtml(note, me, index) {
    const state = stateOf(note);
    const mine = note.author === me.id;
    const tilt = [-0.8, 0.6, -0.3, 0.9, -0.6, 0.4][index % 6];
    const style = `style="--tilt:${tilt}deg;animation-delay:${Math.min(index, 8) * 60}ms"`;

    if (state === "sealed-dated" || state === "sealed-open-when") {
      const hint =
        state === "sealed-dated"
          ? `${countdown(note.unlockDate)}`
          : mine
          ? `Waiting for ${UI.escape(Auth.otherUser().displayName)}`
          : "Open when it feels right";
      return `
        <button type="button" class="envelope" data-note-id="${UI.escape(note.id)}" ${style}>
          <span class="envelope__flap" aria-hidden="true"></span>
          <span class="seal envelope__seal" aria-hidden="true">${UI.icon("us")}</span>
          <span class="envelope__body">
            <span class="envelope__to">${mine ? `to ${UI.escape(Auth.otherUser().displayName)}` : `from ${UI.escape(authorName(note.author))}`}</span>
            <span class="envelope__title">${UI.escape(note.title)}</span>
            <span class="envelope__hint">${hint}${state === "sealed-dated" ? ` · ${UI.formatLongDate(note.unlockDate)}` : ""}</span>
          </span>
        </button>
      `;
    }

    return `
      <button type="button" class="letter" data-note-id="${UI.escape(note.id)}" ${style}>
        <span class="letter__meta">
          <span>${mine ? "from you" : `from ${UI.escape(authorName(note.author))}`}</span>
          <span>${formatDate(note.date)}</span>
        </span>
        <span class="letter__title">${UI.escape(note.title)}</span>
        <span class="letter__message">${UI.escape(note.message)}</span>
        <span class="letter__sign">${UI.escape(authorName(note.author))}</span>
      </button>
    `;
  }

  function filtered(notes, me) {
    const sorted = [...notes].sort((a, b) => b.date - a.date);
    if (filter === "mine") return sorted.filter((n) => n.author === me.id);
    if (filter === "theirs") return sorted.filter((n) => n.author !== me.id);
    return sorted;
  }

  function renderGrid(root, me) {
    const notes = filtered(loadNotes(), me);
    const grid = root.querySelector(".notes-grid");
    if (!notes.length) {
      grid.innerHTML = `
        <div class="empty-state empty-state--card">
          <div class="empty-state__icon">${UI.icon("notes")}</div>
          <p class="empty-state__title">${filter === "theirs" ? "Nothing here yet." : "No notes yet."}</p>
          <p class="empty-state__subtitle">${filter === "theirs" ? "Their notes to you will gather here." : "Leave something sweet for them to find."}</p>
        </div>`;
      return;
    }
    grid.innerHTML = notes.map((n, i) => cardHtml(n, me, i)).join("");
  }

  // ---------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------
  function openReader(note, me, onChange) {
    const mine = note.author === me.id;
    const panel = UI.openModal({
      variant: "modal__panel--note",
      label: note.title,
      content: `
        <p class="note-reader__eyebrow">${mine ? "You wrote" : `${UI.escape(authorName(note.author))} wrote`} · ${formatDate(note.date)}</p>
        <h2 class="note-reader__title">${UI.escape(note.title)}</h2>
        <p class="note-reader__message">${UI.escape(note.message)}</p>
        <p class="note-reader__sign">${UI.escape(authorName(note.author))}</p>
        ${
          mine
            ? `<div class="modal__actions modal__actions--start"><button type="button" class="btn btn--text btn--text-danger" data-delete>${UI.icon("trash")} Delete note</button></div>`
            : ""
        }
      `,
    });
    const del = panel.querySelector("[data-delete]");
    if (del) {
      del.addEventListener("click", async () => {
        UI.closeModal();
        const ok = await UI.confirm({
          title: "Delete this note?",
          message: "It will be gone for both of you.",
          confirmLabel: "Delete",
          danger: true,
        });
        if (!ok) return;
        saveNotes(loadNotes().filter((n) => n.id !== note.id));
        onChange();
        Toast.show("Note deleted.");
      });
    }
  }

  async function openSealed(note, me, onChange) {
    const state = stateOf(note);
    const mine = note.author === me.id;

    if (mine) {
      const panel = UI.openModal({
        variant: "modal__panel--small",
        label: "Sealed note",
        content: `
          <div class="seal seal--modal" aria-hidden="true">${UI.icon("us")}</div>
          <h2 class="modal__title">${UI.escape(note.title)}</h2>
          <p class="modal__panel-text">${
            state === "sealed-dated"
              ? `This stays sealed until ${UI.formatLongDate(note.unlockDate)}.`
              : `${UI.escape(Auth.otherUser().displayName)} can open this whenever they need it.`
          }</p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-delete>Delete</button>
            <button type="button" class="btn btn--primary" data-close-modal>Lovely</button>
          </div>
        `,
      });
      panel.querySelector("[data-close-modal]").addEventListener("click", UI.closeModal);
      panel.querySelector("[data-delete]").addEventListener("click", async () => {
        UI.closeModal();
        const ok = await UI.confirm({ title: "Delete this sealed note?", confirmLabel: "Delete", danger: true });
        if (!ok) return;
        saveNotes(loadNotes().filter((n) => n.id !== note.id));
        onChange();
        Toast.show("Note deleted.");
      });
      return;
    }

    if (state === "sealed-dated") {
      const panel = UI.openModal({
        variant: "modal__panel--small",
        label: "Not yet",
        content: `
          <div class="seal seal--modal" aria-hidden="true">${UI.icon("us")}</div>
          <h2 class="modal__title">Not quite yet</h2>
          <p class="modal__panel-text">${UI.escape(authorName(note.author))} sealed this until ${UI.formatLongDate(note.unlockDate)}. ${countdown(note.unlockDate)}.</p>
          <button type="button" class="btn btn--primary" data-close-modal>I'll wait</button>
        `,
      });
      panel.querySelector("[data-close-modal]").addEventListener("click", UI.closeModal);
      return;
    }

    const ok = await UI.confirm({
      title: note.title,
      message: "Once it's open, it stays open. Is now the moment?",
      confirmLabel: "Open it",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    const updated = { ...note, locked: false, openedAt: Date.now() };
    saveNotes(loadNotes().map((n) => (n.id === note.id ? updated : n)));
    onChange();
    openReader(updated, me, onChange);
  }

  // ---------------------------------------------------------------
  // Writing
  // ---------------------------------------------------------------
  function openComposer(me, onChange) {
    const other = Auth.otherUser();
    const tomorrow = UI.toInputDate(new Date(Date.now() + UI.DAY));
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Write a note",
      content: `
        <h2 class="modal__title">A note for ${UI.escape(other.displayName)}</h2>
        <form class="form" id="note-form" novalidate>
          <label class="field">
            <span class="field__label">Title</span>
            <input class="field__input" name="title" maxlength="80" placeholder="Open when you miss me" required autofocus />
          </label>
          <label class="field">
            <span class="field__label">Your note</span>
            <textarea class="field__input field__input--area" name="message" rows="6" maxlength="2000" placeholder="Write from the heart…" required></textarea>
          </label>

          <fieldset class="field">
            <legend class="field__label">When can they read it?</legend>
            <div class="segmented" role="radiogroup">
              <label class="segmented__option"><input type="radio" name="seal" value="now" checked /><span>Right away</span></label>
              <label class="segmented__option"><input type="radio" name="seal" value="when" /><span>Open when…</span></label>
              <label class="segmented__option"><input type="radio" name="seal" value="date" /><span>On a date</span></label>
            </div>
            <p class="field__hint" id="seal-hint">They'll see it straight away.</p>
          </fieldset>

          <label class="field" id="unlock-field" hidden>
            <span class="field__label">Unseal on</span>
            <input class="field__input" type="date" name="unlockDate" min="${tomorrow}" value="${nextAnniversaryIso() > tomorrow ? nextAnniversaryIso() : tomorrow}" />
          </label>

          <p class="form__error" id="note-error" role="alert" hidden></p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn--primary">Leave note</button>
          </div>
        </form>
      `,
    });

    const form = panel.querySelector("#note-form");
    const hint = panel.querySelector("#seal-hint");
    const unlockField = panel.querySelector("#unlock-field");
    const error = panel.querySelector("#note-error");
    panel.querySelector(".modal__actions [data-close-modal]").addEventListener("click", UI.closeModal);

    const hints = {
      now: "They'll see it straight away.",
      when: "Sealed until they decide they need it.",
      date: "Sealed until the day you choose, then it opens by itself.",
    };
    form.addEventListener("change", (e) => {
      if (e.target.name !== "seal") return;
      hint.textContent = hints[e.target.value];
      unlockField.hidden = e.target.value !== "date";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const title = String(data.get("title") || "").trim();
      const message = String(data.get("message") || "").trim();
      const seal = data.get("seal");
      const unlockDate = seal === "date" ? String(data.get("unlockDate") || "") : null;

      let problem = "";
      if (!title) problem = "Give your note a little title.";
      else if (!message) problem = "Your note is empty. Write a few words.";
      else if (seal === "date" && (!unlockDate || unlockDate < tomorrow)) problem = "Pick a date from tomorrow onwards.";
      if (problem) {
        error.textContent = problem;
        error.hidden = false;
        return;
      }

      const note = {
        id: UI.uid("n"),
        title,
        message,
        author: me.id,
        date: Date.now(),
        locked: seal !== "now",
        unlockDate,
      };
      if (!saveNotes([note, ...loadNotes()])) return;
      UI.closeModal();
      filter = "all";
      onChange();
      Toast.show(seal === "now" ? "Note left ❤️" : "Note sealed ❤️");
    });
  }

  // ---------------------------------------------------------------
  function render(root) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();

    root.innerHTML = `
      <section class="notes-view">
        <header class="page-header page-header--with-action">
          <div>
            <h1 class="page-header__title">Love <em>notes</em></h1>
            <p class="page-header__subtitle">Little letters, left for each other.</p>
          </div>
          <button type="button" class="btn btn--primary btn--icon-text" id="new-note-btn">${UI.icon("plus")}<span>Write</span></button>
        </header>
        <div class="tabs" role="tablist" aria-label="Filter notes">
          <button type="button" class="tabs__item" role="tab" data-filter="all">All</button>
          <button type="button" class="tabs__item" role="tab" data-filter="theirs">From ${UI.escape(other.displayName)}</button>
          <button type="button" class="tabs__item" role="tab" data-filter="mine">From you</button>
        </div>
        <div class="notes-grid"></div>
      </section>
    `;

    const refresh = () => {
      root.querySelectorAll("[data-filter]").forEach((t) => {
        const on = t.dataset.filter === filter;
        t.classList.toggle("tabs__item--active", on);
        t.setAttribute("aria-selected", String(on));
      });
      renderGrid(root, me);
    };
    refresh();

    root.querySelector("#new-note-btn").addEventListener("click", () => openComposer(me, refresh));
    root.querySelectorAll("[data-filter]").forEach((t) =>
      t.addEventListener("click", () => {
        filter = t.dataset.filter;
        refresh();
      })
    );

    root.querySelector(".notes-grid").addEventListener("click", (e) => {
      const card = e.target.closest("[data-note-id]");
      if (!card) return;
      const note = loadNotes().find((n) => n.id === card.dataset.noteId);
      if (!note) return;
      if (stateOf(note) === "open") openReader(note, me, refresh);
      else openSealed(note, me, refresh);
    });
  }

  return { render, loadNotes };
})();

Router.register("notes", Notes.render);
