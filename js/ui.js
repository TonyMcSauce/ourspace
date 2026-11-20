/**
 * ui.js
 * Small shared UI helpers used by every feature module:
 * HTML escaping, inline SVG icons, a reusable modal/sheet,
 * date formatting, and client-side image downscaling for uploads.
 */

const UI = (() => {
  function escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Stroke icons, 24px grid. Inherit colour from currentColor.
  const ICON_PATHS = {
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/>',
    notes: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Z"/><path d="m4.5 6.5 7.5 6 7.5-6"/>',
    memories: '<rect x="3" y="5" width="18" height="15" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="m21 16-4.5-4.5L7 20"/>',
    us: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    send: '<path d="M4.5 12 20 4.5 15.5 20l-3.2-6.3Z"/><path d="m12.3 13.7 7.7-9.2"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
    clip: '<path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.2-8.2a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    wallpaper: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 15.5 9 10l4 4 2.5-2.5 5 5"/><path d="M15 3.5v4M3.5 8h4" opacity=".6"/>',
    play: '<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="7" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1" fill="currentColor" stroke="none"/>',
    flip: '<path d="M4 9a8 8 0 0 1 14.5-3.5M20 4v4h-4M20 15a8 8 0 0 1-14.5 3.5M4 20v-4h4"/>',
    together: '<path d="M12 3.5 13.9 8l4.6.4-3.5 3 1.1 4.6L12 13.5 7.9 16l1.1-4.6-3.5-3 4.6-.4Z"/><path d="M5 19.5h14"/>',
    jar: '<path d="M8 3.5h8M7.5 3.5v2.2c0 .8-.6 1.3-1.3 1.8A4.5 4.5 0 0 0 4.5 11v7a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-7a4.5 4.5 0 0 0-1.7-3.5c-.7-.5-1.3-1-1.3-1.8V3.5"/><path d="M12 16.5s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4Z"/>',
    capsule: '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="m3.5 6.5 1.2 1.2 2-2.2M3.5 12l1.2 1.2 2-2.2"/><circle cx="5" cy="17.5" r="1.2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    lockOpen: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    chevronLeft: '<path d="m15 5-7 7 7 7"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  };

  function icon(name, extraClass = "") {
    return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;
  }

  // ---------------------------------------------------------------
  // Modal / bottom sheet
  // ---------------------------------------------------------------
  let activeModal = null;

  function closeModal() {
    if (!activeModal) return;
    const { el, onClose, returnFocus } = activeModal;
    activeModal = null;
    el.classList.add("modal--closing");
    document.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("has-modal");
    setTimeout(() => el.remove(), 180);
    if (onClose) onClose();
    if (returnFocus && document.contains(returnFocus) && returnFocus !== document.body) {
      returnFocus.focus({ preventScroll: true });
    } else {
      const root = document.getElementById("view-root");
      if (root) root.focus({ preventScroll: true });
    }
  }

  function onKeydown(e) {
    if (!activeModal) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }
    if (activeModal.onKey) activeModal.onKey(e);
    if (e.key === "Tab") {
      const focusables = activeModal.el.querySelectorAll(
        'button:not([disabled]), [href], input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * Opens a modal. `content` is trusted HTML built by the caller
   * (user text must already be escaped). Returns the panel element.
   */
  function openModal({ content, variant = "", label = "Dialog", onClose, onKey, autofocus = true }) {
    if (activeModal) closeModal();
    const el = document.createElement("div");
    el.className = "modal";
    el.innerHTML = `
      <div class="modal__backdrop" data-close-modal></div>
      <div class="modal__panel ${variant}" role="dialog" aria-modal="true" aria-label="${escape(label)}">
        <button type="button" class="modal__close" data-close-modal aria-label="Close">${icon("close")}</button>
        ${content}
      </div>
    `;
    document.body.appendChild(el);
    document.body.classList.add("has-modal");
    activeModal = { el, onClose, onKey, returnFocus: document.activeElement };

    el.querySelectorAll("[data-close-modal]").forEach((btn) => btn.addEventListener("click", closeModal));
    document.addEventListener("keydown", onKeydown);

    const panel = el.querySelector(".modal__panel");
    if (autofocus) {
      requestAnimationFrame(() => {
        const target = panel.querySelector("[autofocus]") || panel.querySelector("input, textarea") || panel.querySelector(".modal__close");
        if (target) target.focus({ preventScroll: true });
      });
    }
    return panel;
  }

  /** Promise-based confirm dialog, styled to match the app. */
  function confirm({ title, message = "", confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const panel = openModal({
        variant: "modal__panel--small",
        label: title,
        onClose: () => finish(false),
        content: `
          <h2 class="modal__title">${escape(title)}</h2>
          ${message ? `<p class="modal__panel-text">${escape(message)}</p>` : ""}
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>${escape(cancelLabel)}</button>
            <button type="button" class="btn ${danger ? "btn--danger" : "btn--primary"}" data-confirm autofocus>${escape(confirmLabel)}</button>
          </div>
        `,
      });
      panel.querySelector("[data-cancel]").addEventListener("click", () => {
        finish(false);
        closeModal();
      });
      panel.querySelector("[data-confirm]").addEventListener("click", () => {
        finish(true);
        closeModal();
      });
    });
  }

  // ---------------------------------------------------------------
  // Dates
  // ---------------------------------------------------------------
  const DAY = 24 * 60 * 60 * 1000;

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
  }

  /** Parse "YYYY-MM-DD" as a local date (not UTC). */
  function parseLocalDate(value) {
    if (!isIsoDate(value)) return null;
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function toInputDate(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatLongDate(value) {
    const d = isIsoDate(value) ? parseLocalDate(value) : new Date(value);
    if (Number.isNaN(d?.getTime?.())) return String(value ?? "");
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  function formatMonthYear(value) {
    const d = isIsoDate(value) ? parseLocalDate(value) : null;
    if (!d) return String(value ?? "");
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function daysBetween(a, b) {
    return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  }

  function dayLabel(ts) {
    const diff = daysBetween(ts, Date.now());
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: "long" });
    return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  // ---------------------------------------------------------------
  // Images: downscale before saving so localStorage doesn't fill up.
  // ---------------------------------------------------------------
  function readImage(file, { maxSize = 1280, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("That file isn't an image."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that image."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't open that image."));
        img.onload = () => {
          // Each saved photo must stay well under Firestore's 1 MB
          // document limit, so shrink until it fits.
          const LIMIT = 700 * 1024;
          let size = maxSize;
          let q = quality;
          let data = "";
          for (let attempt = 0; attempt < 6; attempt++) {
            const scale = Math.min(1, size / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            data = canvas.toDataURL("image/jpeg", q);
            if (data.length <= LIMIT) break;
            size = Math.round(size * 0.8);
            q = Math.max(0.6, q - 0.06);
          }
          resolve(data);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** A little burst of hearts from an element (ticks, heartbeats). */
  function burstHearts(from, count = 7) {
    if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = from.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const h = document.createElement("span");
      h.className = "heart-burst";
      h.innerHTML = icon("us");
      h.style.left = `${rect.left + rect.width / 2}px`;
      h.style.top = `${rect.top + rect.height / 2}px`;
      h.style.setProperty("--dx", `${(Math.random() - 0.5) * 140}px`);
      h.style.setProperty("--dy", `${-50 - Math.random() * 100}px`);
      h.style.setProperty("--r", `${(Math.random() - 0.5) * 60}deg`);
      h.style.animationDelay = `${i * 40}ms`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  /** Natural pixel size of an image data URL. */
  function imageSize(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = src;
    });
  }

  function uid(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  return {
    escape,
    icon,
    openModal,
    closeModal,
    confirm,
    parseLocalDate,
    isIsoDate,
    toInputDate,
    formatLongDate,
    formatMonthYear,
    daysBetween,
    dayLabel,
    startOfDay,
    readImage,
    burstHearts,
    imageSize,
    uid,
    DAY,
  };
})();
