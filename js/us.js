/**
 * us.js
 * Couple profile / dashboard page: header, relationship counter,
 * journey timeline, favourite things, and settings (dark mode, logout).
 */

const Us = (() => {
  function favouriteCardHtml(icon, label, value) {
    return `
      <div class="fav-card">
        <span class="fav-card__icon">${icon}</span>
        <div class="fav-card__text">
          <p class="fav-card__label">${label}</p>
          <p class="fav-card__value"></p>
        </div>
      </div>
    `;
  }

  function render(root) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    const events = Journey.loadEvents();
    const fav = CONFIG.favouriteThings;
    const currentTheme = Storage.getTheme();

    root.innerHTML = `
      <section class="us-view">
        <header class="us-header">
          <p class="us-header__brand">\u2764\uFE0F ${CONFIG.appName}</p>
          <h1 class="us-header__names">${CONFIG.users.tony.displayName} + ${CONFIG.users.babegirl.displayName}</h1>
          <p class="us-header__since">Together since <span id="since-date"></span></p>
        </header>

        ${Journey.counterHtml()}

        <div class="section-block">
          <h2 class="section-block__title">Our Journey</h2>
          ${Journey.timelineHtml(events)}
        </div>

        <div class="section-block">
          <h2 class="section-block__title">Our Song</h2>
          <div class="song-card">
            <span class="song-card__icon">\uD83C\uDFB5</span>
            <div>
              <p class="song-card__title">Our Song</p>
              <p class="song-card__status">Coming soon</p>
            </div>
          </div>
        </div>

        <div class="section-block">
          <h2 class="section-block__title">Favourite Things</h2>
          <div class="fav-grid">
            ${favouriteCardHtml("\uD83C\uDF54", "Favourite food", fav.food)}
            ${favouriteCardHtml("\uD83D\uDCCD", "Favourite place", fav.place)}
            ${favouriteCardHtml("\uD83C\uDFAC", "Favourite movie", fav.movie)}
            ${favouriteCardHtml("\uD83D\uDE02", "Inside joke", fav.insideJoke)}
          </div>
        </div>

        <div class="section-block">
          <h2 class="section-block__title">Settings</h2>
          <div class="settings-card">
            <div class="settings-row">
              <div>
                <p class="settings-row__label">Dark mode</p>
                <p class="settings-row__hint">Easier on the eyes at night</p>
              </div>
              <button
                type="button"
                class="toggle ${currentTheme === "dark" ? "toggle--on" : ""}"
                id="theme-toggle"
                role="switch"
                aria-checked="${currentTheme === "dark"}"
                aria-label="Toggle dark mode"
              >
                <span class="toggle__thumb"></span>
              </button>
            </div>
            <div class="settings-row">
              <div>
                <p class="settings-row__label">Signed in as</p>
                <p class="settings-row__hint">${me.displayName}</p>
              </div>
              <button type="button" class="btn btn--ghost" id="logout-btn">Log out</button>
            </div>
          </div>
        </div>
      </section>
    `;

    // Hydrate text values via textContent to keep escaping consistent.
    root.querySelector("#since-date").textContent = new Date(CONFIG.relationshipStartDate).toLocaleDateString(
      undefined,
      { day: "numeric", month: "long", year: "numeric" }
    );
    root.querySelectorAll(".fav-card__value").forEach((el, i) => {
      const values = [fav.food, fav.place, fav.movie, fav.insideJoke];
      el.textContent = values[i];
    });
    Journey.hydrateLabels(root, events);
    Journey.attachInteractions(root);

    root.querySelector("#theme-toggle").addEventListener("click", () => {
      ThemeManager.toggle();
      const btn = root.querySelector("#theme-toggle");
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      btn.classList.toggle("toggle--on", isDark);
      btn.setAttribute("aria-checked", String(isDark));
    });

    root.querySelector("#logout-btn").addEventListener("click", () => {
      Auth.logout();
      window.location.hash = "";
      App.renderShell();
    });
  }

  return { render };
})();

Router.register("us", Us.render);
