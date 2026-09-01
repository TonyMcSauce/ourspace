/**
 * notes.js
 * Love Notes: short cards separate from the chat stream.
 * Locked notes are visual-only in V1 — the date-unlock structure
 * is stubbed in each note's `unlockDate` field for a future version.
 */

const Notes = (() => {
  function seedNotes() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return [
      {
        id: "n1",
        title: "Just because",
        message: "Just a reminder that I'm proud of you. Not for anything specific \u2014 just for being you, today, doing your best.",
        author: "tony",
        date: now - 2 * day,
        locked: false,
        unlockDate: null,
      },
      {
        id: "n2",
        title: "For the hard days",
        message: "For when you're having a bad day \u2764\uFE0F. Read this, take a breath, and remember it's temporary. I've got you.",
        author: "tony",
        date: now - 6 * day,
        locked: false,
        unlockDate: null,
      },
      {
        id: "n3",
        title: "Open when you need a little extra love",
        message: "This one's locked \u2014 saving it for a day you really need it.",
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
    ];
  }

  function loadNotes() {
    let notes = Storage.getNotes();
    if (!notes) {
      notes = seedNotes();
      Storage.setNotes(notes);
    }
    return notes;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function noteCardHtml(note) {
    const authorName = CONFIG.users[note.author]?.displayName || note.author;
    if (note.locked) {
      return `
        <article class="note-card note-card--locked" data-note-id="${note.id}">
          <div class="note-card__icon">\uD83D\uDD12</div>
          <h3 class="note-card__title"></h3>
          <button type="button" class="note-card__lock-btn" data-locked-note="${note.id}">Locked</button>
        </article>
      `;
    }
    return `
      <article class="note-card" data-note-id="${note.id}">
        <div class="note-card__icon">\uD83D\uDC8C</div>
        <h3 class="note-card__title"></h3>
        <p class="note-card__message"></p>
        <footer class="note-card__footer">
          <span class="note-card__author"></span>
          <span class="note-card__date">${formatDate(note.date)}</span>
        </footer>
      </article>
    `;
  }

  function render(root) {
    const notes = loadNotes();

    root.innerHTML = `
      <section class="notes-view">
        <header class="page-header">
          <h1 class="page-header__title">Love Notes</h1>
          <p class="page-header__subtitle">Little things, saved for you.</p>
        </header>
        <div class="notes-grid">
          ${notes.map(noteCardHtml).join("")}
        </div>
      </section>
      <div class="modal" id="locked-modal" hidden>
        <div class="modal__backdrop" data-close-modal></div>
        <div class="modal__panel modal__panel--small" role="dialog" aria-modal="true">
          <div class="modal__panel-icon">\uD83D\uDD12</div>
          <p class="modal__panel-text">This note will become available in a future version.</p>
          <button type="button" class="btn btn--primary" data-close-modal>Okay</button>
        </div>
      </div>
    `;

    notes.forEach((note) => {
      if (note.locked) return;
      const card = root.querySelector(`[data-note-id="${note.id}"]`);
      card.querySelector(".note-card__title").textContent = note.title;
      card.querySelector(".note-card__message").textContent = note.message;
      card.querySelector(".note-card__author").textContent = `\u2014 ${CONFIG.users[note.author]?.displayName || note.author}`;
    });

    root.querySelectorAll(".note-card--locked .note-card__title").forEach((el, i) => {
      const lockedNotes = notes.filter((n) => n.locked);
      el.textContent = lockedNotes[i]?.title || "";
    });

    const modal = root.querySelector("#locked-modal");
    root.querySelectorAll("[data-locked-note]").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.hidden = false;
      });
    });
    modal.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        modal.hidden = true;
      });
    });
  }

  return { render };
})();

Router.register("notes", Notes.render);
