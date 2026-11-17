/**
 * us.js
 * Couple profile / dashboard page: header, relationship counter,
 * a few small stats, journey timeline, our song, favourite things,
 * and settings (dark mode, logout).
 */

const Us = (() => {
  const FAVOURITES = [
    { key: "food", icon: "🍜", label: "Favourite food" },
    { key: "place", icon: "📍", label: "Favourite place" },
    { key: "movie", icon: "🎬", label: "Favourite movie" },
    { key: "insideJoke", icon: "😂", label: "Inside joke" },
  ];

  function favourites() {
    return { ...CONFIG.favouriteThings, ...(Storage.getFavourites() || {}) };
  }

  function song() {
    return { ...CONFIG.song, ...(Storage.getSong() || {}) };
  }

  function safeLink(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch {
      return "";
    }
  }

  function statsHtml() {
    const messages = Chat.loadMessages().length;
    const notes = Notes.loadNotes().length;
    const memories = Memories.loadMemories().length;
    const stat = (n, label, href) => `
      <a class="stat" href="${href}">
        <span class="stat__number">${n.toLocaleString()}</span>
        <span class="stat__label">${label}</span>
      </a>`;
    return `
      <div class="stats">
        ${stat(messages, messages === 1 ? "Message" : "Messages", "#/chat")}
        ${stat(notes, notes === 1 ? "Love note" : "Love notes", "#/notes")}
        ${stat(memories, memories === 1 ? "Memory" : "Memories", "#/memories")}
      </div>
    `;
  }

  function songHtml() {
    const s = song();
    const link = safeLink(s.link);
    if (!s.title) {
      return `
        <button type="button" class="song-card song-card--empty" id="edit-song">
          <span class="song-card__art">${UI.icon("music")}</span>
          <span class="song-card__text">
            <span class="song-card__title">Choose your song</span>
            <span class="song-card__artist">The one that's always been yours.</span>
          </span>
          <span class="song-card__action">${UI.icon("plus")}</span>
        </button>`;
    }
    return `
      <div class="song-card">
        <span class="song-card__art">${UI.icon("music")}</span>
        <span class="song-card__text">
          <span class="song-card__title">${UI.escape(s.title)}</span>
          <span class="song-card__artist">${UI.escape(s.artist || "Our song")}</span>
        </span>
        ${link ? `<a class="icon-btn" href="${UI.escape(link)}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${UI.escape(s.title)}">${UI.icon("external")}</a>` : ""}
        <button type="button" class="icon-btn" id="edit-song" aria-label="Edit our song">${UI.icon("edit")}</button>
      </div>`;
  }

  function favouritesHtml() {
    const fav = favourites();
    return FAVOURITES.map(
      (f) => `
      <div class="fav-card">
        <span class="fav-card__icon" aria-hidden="true">${f.icon}</span>
        <div class="fav-card__text">
          <p class="fav-card__label">${f.label}</p>
          <p class="fav-card__value">${UI.escape(fav[f.key] || "Not decided yet")}</p>
        </div>
      </div>`
    ).join("");
  }

  function openSongEditor(onChange) {
    const s = song();
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Our song",
      content: `
        <h2 class="modal__title">Our song</h2>
        <form class="form" id="song-form" novalidate>
          <label class="field">
            <span class="field__label">Song</span>
            <input class="field__input" name="title" maxlength="80" value="${UI.escape(s.title)}" placeholder="The one that plays in your head" autofocus />
          </label>
          <label class="field">
            <span class="field__label">Artist</span>
            <input class="field__input" name="artist" maxlength="80" value="${UI.escape(s.artist)}" placeholder="Who sings it" />
          </label>
          <label class="field">
            <span class="field__label">Link <span class="field__optional">(optional)</span></span>
            <input class="field__input" name="link" type="url" inputmode="url" value="${UI.escape(s.link)}" placeholder="https://open.spotify.com/…" />
            <span class="field__hint">Spotify, Apple Music, YouTube, anything that plays it.</span>
          </label>
          <p class="form__error" id="song-error" role="alert" hidden></p>
          <div class="modal__actions">
            ${s.title ? `<button type="button" class="btn btn--text btn--text-danger modal__actions-left" data-clear>Clear</button>` : ""}
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Save</button>
          </div>
        </form>
      `,
    });
    const form = panel.querySelector("#song-form");
    const error = panel.querySelector("#song-error");
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    const clear = panel.querySelector("[data-clear]");
    if (clear) {
      clear.addEventListener("click", () => {
        Storage.setSong({ title: "", artist: "", link: "" });
        UI.closeModal();
        onChange();
      });
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const next = {
        title: String(data.get("title") || "").trim(),
        artist: String(data.get("artist") || "").trim(),
        link: String(data.get("link") || "").trim(),
      };
      if (!next.title) {
        error.textContent = "What's the song called?";
        error.hidden = false;
        return;
      }
      if (next.link && !safeLink(next.link)) {
        error.textContent = "That link doesn't look right. It should start with https://";
        error.hidden = false;
        return;
      }
      Storage.setSong(next);
      UI.closeModal();
      onChange();
      Toast.show("Our song is saved 🎵");
    });
  }

  function openFavouritesEditor(onChange) {
    const fav = favourites();
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Favourite things",
      content: `
        <h2 class="modal__title">Favourite things</h2>
        <form class="form" id="fav-form" novalidate>
          ${FAVOURITES.map(
            (f, i) => `
            <label class="field">
              <span class="field__label">${f.icon} ${f.label}</span>
              <input class="field__input" name="${f.key}" maxlength="80" value="${UI.escape(fav[f.key] || "")}" ${i === 0 ? "autofocus" : ""} />
            </label>`
          ).join("")}
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Save</button>
          </div>
        </form>
      `,
    });
    const form = panel.querySelector("#fav-form");
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const next = {};
      FAVOURITES.forEach((f) => (next[f.key] = String(data.get(f.key) || "").trim()));
      Storage.setFavourites(next);
      UI.closeModal();
      onChange();
      Toast.show("Saved ❤️");
    });
  }

  function render(root) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    const users = [CONFIG.users.tony, CONFIG.users.babegirl];
    const isDark = ThemeManager.current() === "dark";

    root.innerHTML = `
      <section class="us-view">
        <header class="us-header">
          <div class="us-header__avatars" aria-hidden="true">
            <span class="avatar avatar--xl">${UI.escape(users[0].avatarInitial)}</span>
            <span class="us-header__heart">${UI.icon("us")}</span>
            <span class="avatar avatar--xl avatar--alt">${UI.escape(users[1].avatarInitial)}</span>
          </div>
          <h1 class="us-header__names">${UI.escape(users[0].displayName)} <span class="us-header__amp">&amp;</span> ${UI.escape(users[1].displayName)}</h1>
          <p class="us-header__since">Together since ${UI.formatLongDate(CONFIG.relationshipStartDate.slice(0, 10))}</p>
        </header>

        <div class="section-block section-block--flush">${Journey.counterHtml()}</div>

        <div class="section-block">${statsHtml()}</div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">Our Journey</h2>
            <button type="button" class="btn btn--text" id="add-milestone">${UI.icon("plus")} Add</button>
          </div>
          <div id="timeline-host">${Journey.timelineHtml(Journey.loadEvents())}</div>
        </div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">Our Song</h2>
          </div>
          <div id="song-host">${songHtml()}</div>
        </div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">Favourite Things</h2>
            <button type="button" class="btn btn--text" id="edit-favs">${UI.icon("edit")} Edit</button>
          </div>
          <div class="fav-grid" id="fav-host">${favouritesHtml()}</div>
        </div>

        <div class="section-block">
          <h2 class="section-block__title">Settings</h2>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row__icon">${UI.icon("moon")}</span>
              <div class="settings-row__text">
                <p class="settings-row__label" id="theme-label">Dark mode</p>
                <p class="settings-row__hint">Easier on the eyes at night</p>
              </div>
              <button
                type="button"
                class="toggle ${isDark ? "toggle--on" : ""}"
                id="theme-toggle"
                role="switch"
                aria-checked="${isDark}"
                aria-labelledby="theme-label"
              >
                <span class="toggle__thumb"></span>
              </button>
            </div>
            <div class="settings-row">
              <span class="settings-row__icon avatar avatar--sm">${UI.escape(me.avatarInitial)}</span>
              <div class="settings-row__text">
                <p class="settings-row__label">Signed in as ${UI.escape(me.displayName)}</p>
                <p class="settings-row__hint">Sharing this space with ${UI.escape(other.displayName)}</p>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" id="logout-btn">Log out</button>
            </div>
          </div>
          <p class="us-footer">Made with love, for the two of you.</p>
        </div>
      </section>
    `;

    const refreshTimeline = () => {
      root.querySelector("#timeline-host").innerHTML = Journey.timelineHtml(Journey.loadEvents());
      Journey.attachInteractions(root.querySelector("#timeline-host"), refreshTimeline);
    };
    const refreshSong = () => {
      root.querySelector("#song-host").innerHTML = songHtml();
      root.querySelector("#edit-song").addEventListener("click", () => openSongEditor(refreshSong));
    };
    const refreshFavs = () => {
      root.querySelector("#fav-host").innerHTML = favouritesHtml();
    };

    Journey.attachInteractions(root, refreshTimeline);
    root.querySelector("#edit-song").addEventListener("click", () => openSongEditor(refreshSong));
    root.querySelector("#add-milestone").addEventListener("click", () => Journey.openAddMilestone(refreshTimeline));
    root.querySelector("#edit-favs").addEventListener("click", () => openFavouritesEditor(refreshFavs));

    root.querySelector("#theme-toggle").addEventListener("click", () => {
      const dark = ThemeManager.toggle() === "dark";
      const btn = root.querySelector("#theme-toggle");
      btn.classList.toggle("toggle--on", dark);
      btn.setAttribute("aria-checked", String(dark));
    });

    root.querySelector("#logout-btn").addEventListener("click", async () => {
      const ok = await UI.confirm({
        title: "Log out?",
        message: "Everything stays saved on this device for when you come back.",
        confirmLabel: "Log out",
      });
      if (ok) App.logout();
    });
  }

  return { render };
})();

Router.register("us", Us.render);
