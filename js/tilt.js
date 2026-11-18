/**
 * tilt.js
 * Gentle 3D tilt with a light sheen for paper objects (Polaroids,
 * letters, envelopes, capsules). Follows the mouse on laptops; on
 * phones it follows your finger while you press, so it never fights
 * with scrolling. Off when the device asks for reduced motion.
 *
 * Sets --rx, --ry (degrees) and --sx, --sy (sheen position, %) on the
 * element; CSS decides how each object uses them.
 */

const Tilt = (() => {
  const SELECTOR = ".polaroid, .letter, .envelope, .on-this-day, .capsule, .countdown";
  const MAX = 9;
  let active = null;
  let frame = null;

  function reduce() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function apply(el, x, y) {
    const r = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (x - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (y - r.top) / r.height));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX}deg`);
      el.style.setProperty("--rx", `${-(py - 0.5) * 2 * MAX}deg`);
      el.style.setProperty("--sx", `${px * 100}%`);
      el.style.setProperty("--sy", `${py * 100}%`);
      el.classList.add("is-tilting");
    });
  }

  function reset(el) {
    if (!el) return;
    cancelAnimationFrame(frame);
    el.classList.remove("is-tilting");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }

  document.addEventListener("pointermove", (e) => {
    if (reduce()) return;
    if (e.pointerType === "touch" && !e.pressure) return;
    const el = e.target.closest && e.target.closest(SELECTOR);
    if (el !== active) {
      reset(active);
      active = el;
    }
    if (el) apply(el, e.clientX, e.clientY);
  });
  document.addEventListener("pointerdown", (e) => {
    if (reduce() || e.pointerType !== "touch") return;
    const el = e.target.closest && e.target.closest(SELECTOR);
    if (!el) return;
    reset(active);
    active = el;
    apply(el, e.clientX, e.clientY);
  });
  ["pointerup", "pointercancel"].forEach((type) =>
    document.addEventListener(type, (e) => {
      if (e.pointerType === "touch") {
        reset(active);
        active = null;
      }
    })
  );
  document.addEventListener("pointerleave", () => {
    reset(active);
    active = null;
  });
  window.addEventListener("scroll", () => {
    if (active) {
      reset(active);
      active = null;
    }
  }, { passive: true });

  return {};
})();
