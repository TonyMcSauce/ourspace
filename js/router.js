/**
 * router.js
 * Minimal hash-based router. No reloads, no dependencies.
 * Each route renders into #view-root via a render function
 * registered from the matching feature module.
 */

const Router = (() => {
  const routes = {};
  let currentRoute = null;
  let rootEl = null;
  let listening = false;
  let cleanups = [];

  /** Let the current page clean up timers/listeners when it's left. */
  function onLeave(fn) {
    cleanups.push(fn);
  }
  function runCleanups() {
    const fns = cleanups;
    cleanups = [];
    fns.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    });
  }

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  function getRouteFromHash() {
    const hash = window.location.hash.replace("#/", "") || "chat";
    return routes[hash] ? hash : "chat";
  }

  function navigate(name) {
    if (!routes[name]) return;
    window.location.hash = `#/${name}`;
  }

  function updateNavIndicator(name) {
    document.querySelectorAll("[data-nav-item]").forEach((el) => {
      const isActive = el.getAttribute("data-nav-item") === name;
      el.classList.toggle("nav-item--active", isActive);
      el.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  async function render() {
    const name = getRouteFromHash();
    if (!rootEl) return;

    if (name === currentRoute) return;
    const isFirstRender = currentRoute === null;
    currentRoute = name;

    if (!isFirstRender) {
      rootEl.classList.add("view-root--leaving");
      await new Promise((r) => setTimeout(r, 120));
      // A newer navigation (or logout) may have happened while waiting.
      if (currentRoute !== name || !document.contains(rootEl)) return;
    }

    runCleanups();
    rootEl.innerHTML = "";
    rootEl.classList.remove("view-root--leaving");
    rootEl.classList.add("view-root--entering");

    const renderFn = routes[name];
    if (renderFn) renderFn(rootEl);

    updateNavIndicator(name);
    const titles = { chat: "Chat", notes: "Love Notes", memories: "Memories", together: "Together", us: "Us" };
    document.title = `${titles[name] || ""} \u00B7 ${CONFIG.appNameShort}`;
    requestAnimationFrame(() => {
      rootEl.classList.remove("view-root--entering");
    });

    window.scrollTo(0, 0);
  }

  function init(rootSelector) {
    // Safe to call again after logout/login: the shell is rebuilt, so
    // reset the cached route and only ever attach one listener.
    rootEl = document.querySelector(rootSelector);
    currentRoute = null;
    if (!listening) {
      window.addEventListener("hashchange", render);
      listening = true;
    }
    render();
  }

  /** Re-render the current view, e.g. after a change from the other person. */
  function refresh({ quiet = false } = {}) {
    if (!rootEl || !document.contains(rootEl)) return;
    const scrollY = window.scrollY;
    currentRoute = null;
    if (quiet) rootEl.classList.add("view-root--quiet");
    render().then(() => {
      if (!quiet) return;
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => rootEl.classList.remove("view-root--quiet"));
    });
  }

  function current() {
    return currentRoute;
  }

  return { register, navigate, init, render, refresh, current, onLeave, runCleanups };
})();
