/**
 * lock.js
 * Optional 4-digit passcode, set separately on each device.
 *
 * - Asked when the app opens, and again after it's been in the
 *   background for more than a minute.
 * - While the app is in the background, a privacy cover hides your
 *   messages from the iPhone app switcher.
 * - Only a salted SHA-256 hash of the code is stored, in this browser.
 * - Forgot it? "Sign out instead" removes the lock; signing back in
 *   needs your real account password.
 */

const Lock = (() => {
  const KEY = "ourspace_lock";
  const RELOCK_AFTER = 60 * 1000;
  const LENGTH = 4;

  let hiddenAt = null;
  let locked = false;
  let cover = null;

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "null");
    } catch {
      return null;
    }
  }
  function write(value) {
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
      return true;
    } catch {
      return false;
    }
  }

  async function hash(salt, code) {
    const bytes = new TextEncoder().encode(`${salt}:${code}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function isEnabled() {
    const me = Auth.currentUser();
    const saved = read();
    return Boolean(me && saved && saved.user === me.id && saved.hash);
  }

  // ---------------------------------------------------------------
  // Keypad screen (used for unlocking and for setting a code)
  // ---------------------------------------------------------------
  function keypadHtml({ title, subtitle, footer }) {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
    return `
      <div class="lock__inner">
        <div class="seal seal--lg lock__seal" aria-hidden="true">${UI.icon("us")}</div>
        <h1 class="lock__title">${title}</h1>
        <p class="lock__subtitle" aria-live="polite">${subtitle}</p>
        <div class="lock__dots" aria-hidden="true">${"<span></span>".repeat(LENGTH)}</div>
        <div class="lock__pad">
          ${keys
            .map((k) =>
              k === ""
                ? "<span></span>"
                : k === "del"
                ? `<button type="button" class="lock__key lock__key--del" data-key="del" aria-label="Delete">${UI.icon("chevronLeft")}</button>`
                : `<button type="button" class="lock__key" data-key="${k}">${k}</button>`
            )
            .join("")}
        </div>
        ${footer ? `<div class="lock__footer">${footer}</div>` : ""}
      </div>`;
  }

  /**
   * Shows a keypad overlay. `onCode(code, ui)` is called for each full
   * entry; it returns true to close the overlay.
   */
  function keypad({ title, subtitle, footer, onCode, onFooter, dismissible = false }) {
    return new Promise((resolve) => {
      const el = document.createElement("div");
      el.className = "lock";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", title.replace(/<[^>]+>/g, ""));
      el.innerHTML = keypadHtml({ title, subtitle, footer });
      document.body.appendChild(el);
      document.body.classList.add("is-locked");

      const dots = el.querySelectorAll(".lock__dots span");
      const sub = el.querySelector(".lock__subtitle");
      let entry = "";
      let busy = false;

      const ui = {
        setSubtitle(text) {
          sub.textContent = text;
        },
        reject(text) {
          el.querySelector(".lock__dots").classList.add("lock__dots--wrong");
          if (navigator.vibrate) navigator.vibrate(120);
          setTimeout(() => {
            el.querySelector(".lock__dots").classList.remove("lock__dots--wrong");
            entry = "";
            paint();
            if (text) sub.textContent = text;
          }, 420);
        },
        reset() {
          entry = "";
          paint();
        },
      };

      function paint() {
        dots.forEach((d, i) => d.classList.toggle("is-filled", i < entry.length));
      }

      function close(result) {
        document.removeEventListener("keydown", onKey);
        el.classList.add("lock--leaving");
        setTimeout(() => {
          el.remove();
          if (!document.querySelector(".lock")) document.body.classList.remove("is-locked");
        }, 260);
        resolve(result);
      }

      async function press(key) {
        if (busy) return;
        if (key === "del") {
          entry = entry.slice(0, -1);
          paint();
          return;
        }
        if (entry.length >= LENGTH) return;
        entry += key;
        paint();
        if (entry.length === LENGTH) {
          busy = true;
          const code = entry;
          const done = await onCode(code, ui);
          busy = false;
          if (done) close(true);
        }
      }

      el.addEventListener("click", (e) => {
        const key = e.target.closest("[data-key]");
        if (key) press(key.dataset.key);
        if (e.target.closest("[data-lock-footer]")) {
          if (onFooter) onFooter(close);
        }
        if (dismissible && e.target.closest("[data-lock-cancel]")) close(false);
      });
      function onKey(e) {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === "Backspace") press("del");
        else if (e.key === "Escape" && dismissible) close(false);
      }
      document.addEventListener("keydown", onKey);
      requestAnimationFrame(() => el.querySelector(".lock__key").focus({ preventScroll: true }));
    });
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  async function unlock() {
    if (!isEnabled() || locked) return;
    locked = true;
    removeCover();
    const saved = read();
    const me = Auth.currentUser();
    let tries = 0;
    let waitUntil = 0;
    await keypad({
      title: `Hi, <em>${UI.escape(me.displayName)}</em>`,
      subtitle: "Enter your passcode",
      footer: `<button type="button" class="lock__link" data-lock-footer>Forgot it? Sign out instead</button>`,
      onFooter: async (close) => {
        const ok = await UI.confirm({
          title: "Sign out?",
          message: "This removes the passcode from this phone. You'll sign back in with your account password.",
          confirmLabel: "Sign out",
        });
        if (!ok) return;
        write(null);
        close(true);
        locked = false;
        App.logout();
      },
      onCode: async (code, ui) => {
        if (Date.now() < waitUntil) {
          ui.reject(`Too many tries. Wait ${Math.ceil((waitUntil - Date.now()) / 1000)} seconds.`);
          return false;
        }
        if ((await hash(saved.salt, code)) === saved.hash) return true;
        tries++;
        if (tries % 5 === 0) {
          waitUntil = Date.now() + 30 * 1000;
          ui.reject("Too many tries. Wait 30 seconds.");
        } else {
          ui.reject("That's not it. Try again.");
        }
        return false;
      },
    });
    locked = false;
  }

  /** Walks through choosing a new code. Resolves true when saved. */
  async function setup() {
    const me = Auth.currentUser();
    let first = null;
    const saved = await keypad({
      title: "Choose a <em>passcode</em>",
      subtitle: "Four digits, just for this phone",
      footer: `<button type="button" class="lock__link" data-lock-cancel>Cancel</button>`,
      dismissible: true,
      onCode: async (code, ui) => {
        if (!first) {
          first = code;
          ui.reset();
          ui.setSubtitle("Enter it once more");
          return false;
        }
        if (code !== first) {
          first = null;
          ui.reject("Those didn't match. Start again.");
          return false;
        }
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
        write({ user: me.id, salt, hash: await hash(salt, code) });
        return true;
      },
    });
    return saved;
  }

  /** Asks for the current code before turning the lock off. */
  async function disable() {
    const saved = read();
    if (!saved) return true;
    const ok = await keypad({
      title: "Turn off <em>passcode</em>",
      subtitle: "Enter your current passcode",
      footer: `<button type="button" class="lock__link" data-lock-cancel>Cancel</button>`,
      dismissible: true,
      onCode: async (code, ui) => {
        if ((await hash(saved.salt, code)) === saved.hash) return true;
        ui.reject("That's not it. Try again.");
        return false;
      },
    });
    if (ok) write(null);
    return ok;
  }

  function addCover() {
    if (cover || !isEnabled()) return;
    cover = document.createElement("div");
    cover.className = "privacy-cover";
    cover.innerHTML = `<div class="seal seal--lg" aria-hidden="true">${UI.icon("us")}</div>`;
    document.body.appendChild(cover);
  }
  function removeCover() {
    if (cover) cover.remove();
    cover = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (!Auth.isAuthenticated()) return;
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      addCover();
      return;
    }
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = null;
    if (isEnabled() && away > RELOCK_AFTER) unlock().then(() => typeof Chat !== "undefined" && Chat.checkIncomingNudges());
    else removeCover();
  });

  return { isEnabled, unlock, setup, disable };
})();
