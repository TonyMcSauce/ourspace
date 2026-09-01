/**
 * app.js
 * Bootstraps the application: shows the login screen or the main
 * shell (nav + view root) depending on auth state, and wires up
 * small shared utilities (theme, toast).
 */

const ThemeManager = (() => {
  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function init() {
    const saved = Storage.getTheme();
    apply(saved);
  }

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    apply(next);
    Storage.setTheme(next);
  }

  return { init, apply, toggle };
})();

const Toast = (() => {
  let timeoutId = null;

  function show(message) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("toast--visible");

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      el.classList.remove("toast--visible");
    }, 2600);
  }

  return { show };
})();

const App = (() => {
  const appEl = document.getElementById("app");

  function loginScreenHtml() {
    return `
      <div class="login-screen">
        <div class="login-card">
          <p class="login-card__brand">\u2764\uFE0F ${CONFIG.appName}</p>
          <p class="login-card__tagline">${CONFIG.tagline}</p>

          <form id="login-form" class="login-form">
            <label class="login-form__label" for="login-username">Name</label>
            <input
              id="login-username"
              class="login-form__input"
              type="text"
              placeholder="Tony or Babegirl"
              autocomplete="username"
              required
            />

            <label class="login-form__label" for="login-password">Password</label>
            <input
              id="login-password"
              class="login-form__input"
              type="password"
              placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
              autocomplete="current-password"
            />

            <p class="login-form__error" id="login-error" hidden></p>

            <button type="submit" class="btn btn--primary btn--full">Enter Our Space</button>
          </form>

          <p class="login-card__note">Private space for two.</p>
        </div>
      </div>
    `;
  }

  function shellHtml() {
    return `
      <div class="app-shell">
        <aside class="sidebar" aria-label="Main navigation">
          <p class="sidebar__brand">\u2764\uFE0F ${CONFIG.appName}</p>
          <nav class="sidebar__nav">
            <a href="#/chat" class="nav-item" data-nav-item="chat"><span class="nav-item__icon">\uD83D\uDCAC</span><span>Chat</span></a>
            <a href="#/notes" class="nav-item" data-nav-item="notes"><span class="nav-item__icon">\u2764\uFE0F</span><span>Notes</span></a>
            <a href="#/memories" class="nav-item" data-nav-item="memories"><span class="nav-item__icon">\uD83D\uDCF8</span><span>Memories</span></a>
            <a href="#/us" class="nav-item" data-nav-item="us"><span class="nav-item__icon">\uD83D\uDC6B</span><span>Us</span></a>
          </nav>
        </aside>

        <main class="view-root" id="view-root"></main>

        <nav class="bottom-nav" aria-label="Main navigation">
          <a href="#/chat" class="nav-item" data-nav-item="chat">
            <span class="nav-item__icon">\uD83D\uDCAC</span>
            <span class="nav-item__label">Chat</span>
          </a>
          <a href="#/notes" class="nav-item" data-nav-item="notes">
            <span class="nav-item__icon">\u2764\uFE0F</span>
            <span class="nav-item__label">Notes</span>
          </a>
          <a href="#/memories" class="nav-item" data-nav-item="memories">
            <span class="nav-item__icon">\uD83D\uDCF8</span>
            <span class="nav-item__label">Memories</span>
          </a>
          <a href="#/us" class="nav-item" data-nav-item="us">
            <span class="nav-item__icon">\uD83D\uDC6B</span>
            <span class="nav-item__label">Us</span>
          </a>
        </nav>
      </div>
    `;
  }

  function renderLogin() {
    appEl.innerHTML = loginScreenHtml();
    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("login-error");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("login-username").value;
      const result = Auth.login(username);
      if (!result.success) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
        form.classList.add("login-form--shake");
        setTimeout(() => form.classList.remove("login-form--shake"), 400);
        return;
      }
      renderShell();
    });
  }

  function renderShell() {
    if (!Auth.isAuthenticated()) {
      renderLogin();
      return;
    }
    appEl.innerHTML = shellHtml();
    window.location.hash = window.location.hash || "#/chat";
    Router.init("#view-root");
  }

  function init() {
    ThemeManager.init();
    renderShell();
  }

  return { init, renderShell };
})();

document.addEventListener("DOMContentLoaded", App.init);
