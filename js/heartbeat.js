/**
 * heartbeat.js
 * "Thinking of you", as a ritual around the wax heart.
 *
 *  Sending: press and hold the heart in the chat header. A ring fills as
 *  it charges; let go to send. A tap sends a little heartbeat, a long
 *  hold sends a strong one (levels 1-3).
 *
 *  Receiving: a 3D heart beats on screen at that strength, with their
 *  photo and a soft synthesized heartbeat.
 *
 *  In sync: if you both send one within a few seconds of each other, you
 *  both get a special "hearts in sync" moment.
 */

const Heartbeat = (() => {
  const CHARGE_MS = 2200;
  const SYNC_MS = 15 * 1000;
  const LEVEL_WORDS = ["", "a little", "a lot", "so, so much"];

  // ---------------------------------------------------------------
  // The button
  // ---------------------------------------------------------------
  function buttonHtml(other) {
    return `
      <button type="button" class="love-btn" id="nudge-btn" aria-label="Hold to send ${UI.escape(other.displayName)} your heartbeat">
        <span class="love-btn__charge" aria-hidden="true">
          <svg viewBox="0 0 48 48"><circle class="love-btn__track" cx="24" cy="24" r="21"/><circle class="love-btn__ring" cx="24" cy="24" r="21" pathLength="100"/></svg>
          <span class="seal love-btn__seal"></span>
        </span>
        <span class="love-btn__label">Hold for love</span>
      </button>`;
  }

  function levelFor(p) {
    return p < 0.3 ? 1 : p < 0.85 ? 2 : 3;
  }

  /** Wire the hold-to-charge interaction. `onSend(level)` returns true if sent. */
  function bind(btn, onSend) {
    let start = 0;
    let raf = 0;
    let charging = false;
    let lastLevel = 0;

    const set = (p) => {
      btn.style.setProperty("--p", p.toFixed(3));
      const level = levelFor(p);
      btn.dataset.level = String(level);
      if (level !== lastLevel) {
        lastLevel = level;
        if (navigator.vibrate) navigator.vibrate(level * 12);
      }
    };
    const tick = () => {
      if (!charging) return;
      set(Math.min(1, (performance.now() - start) / CHARGE_MS));
      raf = requestAnimationFrame(tick);
    };
    const begin = (e) => {
      if (btn.disabled || charging) return;
      if (e) e.preventDefault();
      charging = true;
      lastLevel = 0;
      start = performance.now();
      btn.classList.add("love-btn--charging");
      tick();
    };
    const finish = (cancelled) => {
      if (!charging) return;
      charging = false;
      cancelAnimationFrame(raf);
      const p = Math.min(1, (performance.now() - start) / CHARGE_MS);
      btn.classList.remove("love-btn--charging");
      set(0);
      if (cancelled) return;
      const level = levelFor(p);
      if (onSend(level) === false) return;
      burst(btn, level);
      btn.classList.add("love-btn--sent");
      btn.disabled = true;
      setTimeout(() => btn.classList.remove("love-btn--sent"), 700);
      setTimeout(() => (btn.disabled = false), 6000);
    };

    btn.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      btn.setPointerCapture(e.pointerId);
      begin(e);
    });
    btn.addEventListener("pointerup", () => finish(false));
    btn.addEventListener("pointercancel", () => finish(true));
    btn.addEventListener("lostpointercapture", () => finish(false));
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
    btn.addEventListener("keydown", (e) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) begin(e);
    });
    btn.addEventListener("keyup", (e) => {
      if (e.key === " " || e.key === "Enter") finish(false);
    });
  }

  function burst(from, level) {
    const count = [0, 6, 12, 20][level];
    UI.burstHearts(from, count);
    const ring = document.createElement("span");
    ring.className = `love-wave love-wave--l${level}`;
    const r = from.getBoundingClientRect();
    ring.style.left = `${r.left + r.width / 2}px`;
    ring.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 1200);
  }

  // ---------------------------------------------------------------
  // Sound: a soft "lub-dub", synthesized (no audio files)
  // ---------------------------------------------------------------
  let audio = null;
  function context() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    return audio;
  }
  function thump(ctx, t, freq, peak) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 1.7, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.26);
  }
  function playBeats(level, beats, period) {
    const ctx = context();
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + 0.05;
    const loud = [0, 0.32, 0.42, 0.5][level];
    for (let i = 0; i < beats; i++) {
      const t = t0 + i * period;
      thump(ctx, t, 62, loud);
      thump(ctx, t + 0.17, 52, loud * 0.65);
    }
  }
  // Any tap in the app unlocks sound for later heartbeats.
  ["pointerdown", "keydown"].forEach((t) => window.addEventListener(t, () => context(), { once: true, capture: true }));

  // ---------------------------------------------------------------
  // The moment itself
  // ---------------------------------------------------------------
  function heart3d(extra = "") {
    const layers = 14;
    return `<span class="heart3d ${extra}">${Array.from({ length: layers }, (_, i) => `<span class="heart3d__layer" style="--z:${i};--n:${layers}"></span>`).join("")}</span>`;
  }

  /**
   * Show the heartbeat on screen.
   *   from: user who sent it, level: 1-3, sync: hearts in sync,
   */
  function show({ from, level = 1, sync = false }) {
    if (document.querySelector(".beat")) return;
    level = Math.max(1, Math.min(3, Number(level) || 1));
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    const period = [0, 1.05, 0.82, 0.62][level];
    const beats = [0, 4, 6, 8][level];
    const el = document.createElement("div");
    el.className = `beat beat--l${level} ${sync ? "beat--sync" : ""}`;
    el.style.setProperty("--period", `${period}s`);
    el.setAttribute("role", "alert");
    el.innerHTML = sync
      ? `
        <div class="beat__stage beat__stage--sync" aria-hidden="true">
          <span class="beat__half beat__half--left">${heart3d()}</span>
          <span class="beat__half beat__half--right">${heart3d("heart3d--alt")}</span>
          <span class="beat__faces">${Avatars.html(me, "avatar--lg")}${Avatars.html(other, "avatar--lg")}</span>
        </div>
        <p class="beat__text">Your hearts are <em>in sync</em></p>
        <p class="beat__level">You both reached out at the same moment</p>
        <p class="beat__hint">Tap anywhere</p>`
      : `
        <div class="beat__stage" aria-hidden="true">
          <span class="beat__glow"></span>
          ${heart3d()}
          <span class="beat__face">${Avatars.html(from, "avatar--lg")}</span>
        </div>
        <p class="beat__text"><em>${UI.escape(from.displayName)}</em> is thinking of you</p>
        <p class="beat__level">${LEVEL_WORDS[level]}</p>
        <p class="beat__hint">Tap anywhere</p>`;
    const close = () => {
      el.classList.add("beat--leaving");
      setTimeout(() => el.remove(), 450);
    };
    el.addEventListener("click", close);
    document.body.appendChild(el);
    playBeats(sync ? 3 : level, sync ? 6 : beats, sync ? 0.7 : period);
    if (navigator.vibrate) navigator.vibrate(Array.from({ length: beats }, () => [40, 120, 30, Math.round(period * 1000) - 190]).flat());
    setTimeout(close, Math.max(4200, (sync ? 6 : beats) * period * 1000 + 900));
  }

  /** Did the other person send one just now (so this one is "in sync")? */
  function isSync(messages, fromId) {
    const now = Date.now();
    return messages.some((m) => m.kind === "nudge" && m.from !== fromId && now - m.ts < SYNC_MS);
  }

  return { buttonHtml, bind, show, isSync, LEVEL_WORDS };
})();
