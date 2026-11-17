/**
 * app.js
 * Bootstraps the application: shows the login screen or the main
 * shell (nav + view root) depending on auth state, and wires up
 * small shared utilities (theme, toast).
 */

const ThemeManager = (() => {
  const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function resolve(pref) {
    if (pref === "dark" || pref === "light") return pref;
    return media && media.matches ? "dark" : "light";
  }

  function apply(pref) {
    const theme = resolve(pref);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#1a1216" : "#faf5f0");
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function init() {
    apply(Storage.getTheme());
    if (media) {
      const onChange = () => {
        if (Storage.getTheme() === "system") apply("system");
      };
      if (media.addEventListener) media.addEventListener("change", onChange);
      else if (media.addListener) media.addListener(onChange);
    }
  }

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    apply(next);
    Storage.setTheme(next);
    return next;
  }

  return { init, apply, toggle, current };
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
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("toast--visible");

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      el.classList.remove("toast--visible");
    }, 2800);
  }

  return { show };
})();

const App = (() => {
  const appEl = document.getElementById("app");

  const NAV = [
    { route: "chat", label: "Chat", icon: "chat" },
    { route: "notes", label: "Notes", icon: "notes" },
    { route: "memories", label: "Memories", icon: "memories" },
    { route: "us", label: "Us", icon: "us" },
  ];

  function loginScreenHtml() {
    const names = Object.values(CONFIG.users).map((u) => u.displayName);
    return `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-card__mark" aria-hidden="true">${UI.icon("us")}</div>
          <h1 class="login-card__brand">${UI.escape(CONFIG.appNameShort)}</h1>
          <p class="login-card__tagline">${UI.escape(CONFIG.tagline)}</p>

          <form id="login-form" class="login-form" novalidate>
            <span class="login-form__label" id="login-who">Who's coming in?</span>
            <div class="login-form__people" role="radiogroup" aria-labelledby="login-who">
              ${Object.values(CONFIG.users)
                .map(
                  (u) => `
                <button type="button" class="person-chip" role="radio" aria-checked="false" data-user="${UI.escape(u.displayName)}">
                  <span class="person-chip__avatar">${UI.escape(u.avatarInitial)}</span>
                  <span>${UI.escape(u.displayName)}</span>
                </button>`
                )
                .join("")}
            </div>

            <label class="login-form__label" for="login-username">Name</label>
            <input
              id="login-username"
              class="login-form__input"
              type="text"
              placeholder="${UI.escape(names.join(" or "))}"
              autocomplete="username"
              autocapitalize="words"
              required
            />

            <label class="login-form__label" for="login-password">Password <span class="login-form__optional">(optional for now)</span></label>
            <input
              id="login-password"
              class="login-form__input"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />

            <p class="login-form__error" id="login-error" role="alert" hidden></p>

            <button type="submit" class="btn btn--primary btn--full">Enter Our Space</button>
          </form>

          <p class="login-card__note">A private space, made for two.</p>
        </div>
      </div>
    `;
  }

  function navItemsHtml(withLabels) {
    return NAV.map(
      (n) => `
        <a href="#/${n.route}" class="nav-item" data-nav-item="${n.route}">
          <span class="nav-item__icon">${UI.icon(n.icon)}</span>
          <span class="${withLabels ? "nav-item__label" : ""}">${n.label}</span>
        </a>`
    ).join("");
  }

  function shellHtml() {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    return `
      <div class="app-shell">
        <a class="skip-link" href="#view-root">Skip to content</a>
        <aside class="sidebar" aria-label="Main navigation">
          <p class="sidebar__brand"><span class="sidebar__mark">${UI.icon("us")}</span>${UI.escape(CONFIG.appNameShort)}</p>
          <nav class="sidebar__nav">${navItemsHtml(false)}</nav>
          <div class="sidebar__footer">
            <span class="sidebar__avatars" aria-hidden="true">
              <span class="avatar avatar--sm">${UI.escape(me.avatarInitial)}</span>
              <span class="avatar avatar--sm avatar--alt">${UI.escape(other.avatarInitial)}</span>
            </span>
            <span class="sidebar__who">Signed in as <strong>${UI.escape(me.displayName)}</strong></span>
          </div>
        </aside>

        <main class="view-root" id="view-root" tabindex="-1"></main>

        <nav class="bottom-nav" aria-label="Main navigation">${navItemsHtml(true)}</nav>
      </div>
    `;
  }

  function renderLogin() {
    appEl.innerHTML = loginScreenHtml();
    const form = document.getElementById("login-form");
    const errorEl = document.getElementById("login-error");
    const input = document.getElementById("login-username");
    const chips = form.querySelectorAll(".person-chip");

    function syncChips() {
      const value = input.value.trim().toLowerCase();
      chips.forEach((chip) => {
        const on = chip.dataset.user.toLowerCase() === value;
        chip.classList.toggle("person-chip--active", on);
        chip.setAttribute("aria-checked", String(on));
      });
    }

    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        input.value = chip.dataset.user;
        errorEl.hidden = true;
        syncChips();
        document.getElementById("login-password").focus();
      })
    );
    input.addEventListener("input", () => {
      errorEl.hidden = true;
      syncChips();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const result = Auth.login(input.value);
      if (!result.success) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
        form.classList.add("login-form--shake");
        setTimeout(() => form.classList.remove("login-form--shake"), 400);
        input.focus();
        return;
      }
      if (!window.location.hash || window.location.hash === "#") {
        history.replaceState(null, "", "#/chat");
      }
      renderShell();
    });
  }

  function renderShell() {
    if (!Auth.isAuthenticated()) {
      document.title = CONFIG.appNameShort;
      renderLogin();
      return;
    }
    appEl.innerHTML = shellHtml();
    if (!window.location.hash || window.location.hash === "#") {
      history.replaceState(null, "", "#/chat");
    }
    Router.init("#view-root");
  }

  function logout() {
    UI.closeModal();
    Auth.logout();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    renderShell();
  }

  function init() {
    ThemeManager.init();
    renderShell();
  }

  return { init, renderShell, logout };
})();

document.addEventListener("DOMContentLoaded", App.init);
