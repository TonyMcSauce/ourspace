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
    if (meta) meta.setAttribute("content", theme === "dark" ? "#141110" : "#fbf7f1");
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
    { route: "together", label: "Together", icon: "together" },
    { route: "us", label: "Us", icon: "us" },
  ];

  function estLabel() {
    const d = UI.parseLocalDate(Storage.getStartDate());
    const pad = (n) => String(n).padStart(2, "0");
    return `est. ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function loginScreenHtml() {
    const names = Object.values(CONFIG.users).map((u) => u.displayName);
    return `
      <div class="login-screen">
        <div class="login-card">
          <div class="seal seal--lg" aria-hidden="true">${UI.icon("us")}</div>
          <p class="login-card__kicker">${estLabel()}</p>
          <h1 class="login-card__brand">Our <em>Space</em></h1>
          <p class="login-card__tagline">${UI.escape(CONFIG.tagline)}</p>
          ${
            Object.values(CONFIG.users).some((u) => Avatars.photoOf(u.id))
              ? `<div class="login-card__faces" aria-hidden="true">${Object.values(CONFIG.users).map((u) => Avatars.html(u, "avatar--lg")).join("")}</div>`
              : ""
          }

          <form id="login-form" class="login-form" novalidate>
            ${
              Cloud.enabled
                ? `
            <label class="login-form__label" for="login-username">Email</label>
            <input
              id="login-username"
              class="login-form__input"
              type="email"
              inputmode="email"
              placeholder="you@example.com"
              autocomplete="email username"
              autocapitalize="off"
              spellcheck="false"
              required
            />`
                : `
            <span class="login-form__label" id="login-who">Who's there?</span>
            <div class="login-form__people" role="radiogroup" aria-labelledby="login-who">
              ${Object.values(CONFIG.users)
                .map(
                  (u, i) => `
                <button type="button" class="person-chip" role="radio" aria-checked="false" data-user="${UI.escape(u.displayName)}">
                  ${Avatars.html(u, "avatar--sm")}
                  <span class="person-chip__name">${UI.escape(u.displayName)}</span>
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
            />`
            }

            <label class="login-form__label" for="login-password">Password ${Cloud.enabled ? "" : '<span class="login-form__optional">optional in demo mode</span>'}</label>
            <input
              id="login-password"
              class="login-form__input"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
            />

            <p class="login-form__error" id="login-error" role="alert" hidden></p>

            <button type="submit" class="btn btn--primary btn--full">Come in</button>
          </form>
        </div>
        <p class="login-screen__note">A private place, kept by two.</p>
      </div>
    `;
  }

  function navItemsHtml(sidebar) {
    return NAV.map(
      (n, i) => `
        <a href="#/${n.route}" class="nav-item" data-nav-item="${n.route}">
          ${
            sidebar
              ? `<span class="nav-item__num">0${i + 1}</span><span class="nav-item__text">${n.label}</span>`
              : `<span class="nav-item__icon">${UI.icon(n.icon)}</span><span class="nav-item__label">${n.label}</span>`
          }
          ${n.route !== "us" ? `<span class="nav-badge" data-badge="${n.route}" hidden></span>` : ""}
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
          <p class="sidebar__brand">Our <em>Space</em></p>
          <p class="sidebar__est">${estLabel()}</p>
          <nav class="sidebar__nav">${navItemsHtml(true)}</nav>
          <div class="sidebar__footer">
            <span class="sidebar__avatars" aria-hidden="true">
              ${Avatars.html(me, "avatar--sm")}
              ${Avatars.html(other, "avatar--sm")}
            </span>
            <span class="sidebar__who">Signed in as <strong>${UI.escape(me.displayName)}</strong></span>
          </div>
        </aside>

        <main class="view-root" id="view-root" tabindex="-1"></main>

        <nav class="bottom-nav" aria-label="Main navigation">${navItemsHtml(false)}</nav>
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

    function fail(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      form.classList.add("login-form--shake");
      setTimeout(() => form.classList.remove("login-form--shake"), 400);
    }

    function enter() {
      if (!window.location.hash || window.location.hash === "#") {
        history.replaceState(null, "", "#/chat");
      }
      renderShell();
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!Cloud.enabled) {
        const result = Auth.login(input.value);
        if (!result.success) {
          fail(result.error);
          input.focus();
          return;
        }
        enter();
        return;
      }

      const submit = form.querySelector('button[type="submit"]');
      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = "Opening\u2026";
      try {
        await Cloud.signIn(input.value, document.getElementById("login-password").value);
        enter();
      } catch (err) {
        submit.disabled = false;
        submit.textContent = label;
        fail(err.message);
      }
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
    Activity.start();
    if (Cloud.isActive()) Calls.startWatching();
    setTimeout(Activity.paint, 400);
    if (Lock.isEnabled()) Lock.unlock().then(() => Chat.checkIncomingNudges());
  }

  async function logout() {
    UI.closeModal();
    Router.runCleanups();
    Calls.stopWatching();
    await Auth.logout();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    renderShell();
  }

  function splashHtml(message) {
    return `
      <div class="splash" role="status">
        <div class="seal seal--lg" aria-hidden="true">${UI.icon("us")}</div>
        <p class="splash__text">${UI.escape(message)}</p>
      </div>`;
  }

  // Which views care about which shared data, for live updates.
  const VIEW_DEPENDS = {
    memories: ["memories", "notes", "journey"],
    notes: ["notes", "profile"],
    together: ["jar", "capsules", "lists", "listItems", "profile"],
    us: ["messages", "notes", "memories", "journey", "favourites", "song", "countdown", "profile", "avatars"],
  };

  function watchRemoteChanges() {
    let pending = false;
    const isTypingInPage = () => {
      const el = document.activeElement;
      const root = document.getElementById("view-root");
      // Only hold back while something has actually been typed.
      return Boolean(el && root && root.contains(el) && el.matches("input, textarea") && el.value.trim() && Router.current() !== "chat");
    };
    // Put the cursor back in the same box after a live refresh.
    const rememberFocus = () => {
      const el = document.activeElement;
      const list = el && el.closest && el.closest("[data-list]");
      return list && el.matches("input") ? list.dataset.list : null;
    };
    const restoreFocus = (listId) => {
      if (!listId) return;
      setTimeout(() => {
        const input = document.querySelector(`[data-list="${CSS.escape(listId)}"] .card-list__input`);
        if (input) input.focus({ preventScroll: true });
      }, 30);
    };
    const refreshIfIdle = () => {
      if (document.body.classList.contains("has-modal") || isTypingInPage()) {
        pending = true; // don't yank the page while someone is typing
        return;
      }
      pending = false;
      const focusList = rememberFocus();
      Router.refresh({ quiet: true });
      restoreFocus(focusList);
    };
    Storage.onChange((kind) => {
      if (!Auth.isAuthenticated()) return;
      const route = Router.current();
      if ((VIEW_DEPENDS[route] || []).includes(kind)) refreshIfIdle();
    });
    // Apply a deferred refresh once typing in the page has finished.
    document.addEventListener("focusout", () => {
      setTimeout(() => {
        if (pending && !isTypingInPage() && !document.body.classList.contains("has-modal")) refreshIfIdle();
      }, 0);
    });
    // Apply any deferred refresh once the modal closes.
    new MutationObserver(() => {
      if (pending && !document.body.classList.contains("has-modal")) refreshIfIdle();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    // When a new version takes over, offer a one-tap refresh.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let updateReady = false;
    const inCall = () => document.body.classList.contains("in-call") || (typeof Calls !== "undefined" && Calls.isBusy && Calls.isBusy());
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      updateReady = true;
      // Already in the background: just load the new version now.
      if (document.visibilityState === "hidden" && !inCall()) return location.reload();
      showBanner("update", "A fresh version of Our Space is ready.", "Refresh", () => location.reload());
    });
    // Home Screen apps can stay open for days. Look for a new version each
    // time the app comes back, and apply a waiting one quietly while it's
    // in the background (never during a call).
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        if (updateReady && !inCall()) location.reload();
        return;
      }
      navigator.serviceWorker.getRegistration().then((reg) => reg && reg.update()).catch(() => {});
    });
    // A tapped notification asks the open app to go to the right page.
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (!e.data || e.data.type !== "open") return;
      try {
        const hash = new URL(e.data.url).hash;
        if (/^#\/[a-z]+$/.test(hash)) location.hash = hash;
      } catch {}
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.info("Offline support unavailable.", err));
    });
  }

  // ---------------------------------------------------------------
  // Little banners: offline, update ready
  // ---------------------------------------------------------------
  function showBanner(kind, text, actionLabel, onAction) {
    let el = document.querySelector(`.banner[data-kind="${kind}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "banner";
      el.dataset.kind = kind;
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="banner__dot" aria-hidden="true"></span><span class="banner__text">${UI.escape(text)}</span>${
      actionLabel ? `<button type="button" class="banner__action">${UI.escape(actionLabel)}</button>` : ""
    }`;
    if (actionLabel) el.querySelector(".banner__action").addEventListener("click", onAction);
    requestAnimationFrame(() => el.classList.add("banner--visible"));
    return el;
  }
  function hideBanner(kind, delay = 0) {
    const el = document.querySelector(`.banner[data-kind="${kind}"]`);
    if (!el) return;
    setTimeout(() => {
      el.classList.remove("banner--visible");
      setTimeout(() => el.remove(), 400);
    }, delay);
  }
  function watchConnection() {
    const sync = () => {
      if (navigator.onLine) {
        if (document.querySelector('.banner[data-kind="offline"]')) {
          showBanner("offline", "Back online \u00B7 all synced").classList.add("banner--good");
          hideBanner("offline", 2200);
        }
      } else showBanner("offline", "You're offline \u00B7 we'll sync when you're back");
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    if (!navigator.onLine) sync();
  }

  // Keep the countdown and "last seen" fresh while the app sits open.
  setInterval(() => {
    if (!Auth.isAuthenticated() || document.body.classList.contains("has-modal")) return;
    if (Router.current() === "us") Router.refresh({ quiet: true });
  }, 60 * 1000);

  async function init() {
    registerServiceWorker();
    watchConnection();
    ThemeManager.init();
    if (!Cloud.enabled) {
      renderShell();
      return;
    }
    appEl.innerHTML = splashHtml("Opening our space\u2026");
    try {
      await Cloud.init();
      watchRemoteChanges();
      const user = await Cloud.currentUser();
      if (user) await Cloud.start(user);
    } catch (err) {
      console.error(err);
      if (!window.firebase) {
        appEl.innerHTML = splashHtml("We couldn't connect. Check your internet and refresh the page.");
        return;
      }
    }
    renderShell();
  }

  return { init, renderShell, logout };
})();

document.addEventListener("DOMContentLoaded", App.init);
