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
    currentRoute = name;

    rootEl.classList.add("view-root--leaving");
    await new Promise((r) => setTimeout(r, 120));

    rootEl.innerHTML = "";
    rootEl.classList.remove("view-root--leaving");
    rootEl.classList.add("view-root--entering");

    const renderFn = routes[name];
    if (renderFn) renderFn(rootEl);

    updateNavIndicator(name);
    requestAnimationFrame(() => {
      rootEl.classList.remove("view-root--entering");
    });

    window.scrollTo(0, 0);
  }

  function init(rootSelector) {
    rootEl = document.querySelector(rootSelector);
    window.addEventListener("hashchange", render);
    render();
  }

  return { register, navigate, init, render };
})();
