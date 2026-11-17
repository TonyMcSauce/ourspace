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
    const stat = (n, one, many, href) => `<a class="tally__item" href="${href}"><b>${n.toLocaleString()}</b> ${n === 1 ? one : many}</a>`;
    return `
      <p class="tally">
        So far: ${stat(messages, "message", "messages", "#/chat")},
        ${stat(notes, "love note", "love notes", "#/notes")} and
        ${stat(memories, "memory", "memories", "#/memories")}.
      </p>
    `;
  }

  function songHtml() {
    const s = song();
    const link = safeLink(s.link);
    if (!s.title) {
      return `
        <button type="button" class="record record--empty" id="edit-song">
          <span class="record__disc" aria-hidden="true"><span class="record__label"></span></span>
          <span class="record__text">
            <span class="record__title">Pick your song</span>
            <span class="record__artist">The one that's always been yours.</span>
          </span>
          <span class="record__action">${UI.icon("plus")}</span>
        </button>`;
    }
    return `
      <div class="record">
        <span class="record__disc record__disc--spin" aria-hidden="true"><span class="record__label">${UI.icon("us")}</span></span>
        <span class="record__text">
          <span class="record__title">${UI.escape(s.title)}</span>
          <span class="record__artist">${UI.escape(s.artist || "Our song")}</span>
        </span>
        ${link ? `<a class="icon-btn" href="${UI.escape(link)}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${UI.escape(s.title)}">${UI.icon("external")}</a>` : ""}
        <button type="button" class="icon-btn" id="edit-song" aria-label="Edit our song">${UI.icon("edit")}</button>
      </div>`;
  }

  function favouritesHtml() {
    const fav = favourites();
    return `<dl class="menu">${FAVOURITES.map(
      (f) => `
      <div class="menu__row">
        <dt class="menu__label">${f.label.replace(/^Favourite /, "")}</dt>
        <dd class="menu__value">${UI.escape(fav[f.key] || "Not decided yet")}</dd>
      </div>`
    ).join("")}</dl>`;
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
          <p class="us-header__kicker">${UI.formatLongDate(CONFIG.relationshipStartDate.slice(0, 10))} — today</p>
          <h1 class="us-header__names">${UI.escape(users[0].displayName)} <em>&amp;</em> ${UI.escape(users[1].displayName)}</h1>
        </header>

        <div class="section-block section-block--flush">${Journey.counterHtml()}</div>

        <div class="section-block" id="countdown-host">${Countdown.cardHtml()}</div>

        <div class="section-block">${statsHtml()}</div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">The <em>story</em> so far</h2>
            <button type="button" class="btn btn--text" id="add-milestone">${UI.icon("plus")} Add</button>
          </div>
          <div id="timeline-host">${Journey.timelineHtml(Journey.loadEvents())}</div>
        </div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">Our <em>song</em></h2>
          </div>
          <div id="song-host">${songHtml()}</div>
        </div>

        <div class="section-block">
          <div class="section-block__head">
            <h2 class="section-block__title">Favourite <em>things</em></h2>
            <button type="button" class="btn btn--text" id="edit-favs">${UI.icon("edit")} Edit</button>
          </div>
          <div id="fav-host">${favouritesHtml()}</div>
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
              <span class="settings-row__icon">${UI.icon("lock")}</span>
              <div class="settings-row__text">
                <p class="settings-row__label" id="lock-label">Passcode lock</p>
                <p class="settings-row__hint">Asks for a code when you open the app on this phone</p>
              </div>
              <button
                type="button"
                class="toggle ${Lock.isEnabled() ? "toggle--on" : ""}"
                id="lock-toggle"
                role="switch"
                aria-checked="${Lock.isEnabled()}"
                aria-labelledby="lock-label"
              >
                <span class="toggle__thumb"></span>
              </button>
            </div>
            <div class="settings-row">
              <span class="settings-row__icon avatar avatar--sm ${me.id === Object.keys(CONFIG.users)[1] ? "avatar--alt" : ""}">${UI.escape(me.avatarInitial)}</span>
              <div class="settings-row__text">
                <p class="settings-row__label">Signed in as ${UI.escape(me.displayName)}</p>
                <p class="settings-row__hint">Sharing this space with ${UI.escape(other.displayName)}</p>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" id="logout-btn">Log out</button>
            </div>
          </div>
          <p class="us-footer">Kept with love, by the two of you.</p>
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

    const refreshCountdown = () => {
      root.querySelector("#countdown-host").innerHTML = Countdown.cardHtml();
      root.querySelector("#edit-countdown").addEventListener("click", () => Countdown.openEditor(refreshCountdown));
    };
    root.querySelector("#edit-countdown").addEventListener("click", () => Countdown.openEditor(refreshCountdown));

    const lockToggle = root.querySelector("#lock-toggle");
    lockToggle.addEventListener("click", async () => {
      const done = Lock.isEnabled() ? await Lock.disable() : await Lock.setup();
      const on = Lock.isEnabled();
      lockToggle.classList.toggle("toggle--on", on);
      lockToggle.setAttribute("aria-checked", String(on));
      if (done) Toast.show(on ? "Passcode is on for this phone." : "Passcode turned off.");
    });

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
        message: Cloud.enabled ? "Everything stays safe in your shared space. You'll need your password to sign back in." : "Everything stays saved on this device for when you come back.",
        confirmLabel: "Log out",
      });
      if (ok) App.logout();
    });
  }

  return { render };
})();

Router.register("us", Us.render);
