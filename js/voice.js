/**
 * voice.js
 * Voice notes: recording with a live level meter, and a waveform player.
 *
 * Notes are kept small (mono, ~32 kbps, up to 2 minutes) so each one
 * fits in a single Firestore document on the free plan. A waveform
 * (40 bars) is captured while recording so it can be drawn instantly.
 *
 * Message shape: { kind: "voice", audio: dataURL, mime, duration (s), peaks: [0..1] }
 */

const Voice = (() => {
  const MAX_MS = 2 * 60 * 1000;
  const BARS = 40;
  const MAX_DATA_URL = 900 * 1024;

  // Prefer formats both iPhone and other browsers can play back.
  const TYPES = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

  function supported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  function pickType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function friendlyError(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is off. Allow it in your browser or iPhone settings to send voice notes.";
    if (name === "NotFoundError") return "No microphone found on this device.";
    if (name === "NotReadableError") return "The microphone is busy in another app.";
    return "Couldn't start recording. Please try again.";
  }

  function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Couldn't read the recording."));
      r.readAsDataURL(blob);
    });
  }

  function downsample(levels) {
    if (!levels.length) return new Array(BARS).fill(0.15);
    const out = [];
    for (let i = 0; i < BARS; i++) {
      const from = Math.floor((i * levels.length) / BARS);
      const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / BARS));
      let peak = 0;
      for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j]);
      out.push(peak);
    }
    const max = Math.max(...out, 0.05);
    return out.map((v) => Math.round(Math.max(0.08, Math.min(1, (v / max) * 0.95)) * 100) / 100);
  }

  /**
   * Starts recording. Returns a controller:
   *   stop()   -> Promise<{ audio, mime, duration, peaks }>
   *   cancel() -> void
   * `onLevel(0..1)` fires ~20 times a second, `onTick(ms)` every tick,
   * and `onLimit()` when the 2-minute limit is reached.
   */
  async function start({ onLevel, onTick, onLimit } = {}) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (err) {
      throw new Error(friendlyError(err));
    }

    const mimeType = pickType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    const chunks = [];
    const levels = [];
    recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);

    // Live level meter.
    let ctx = null;
    let analyser = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
    } catch {
      analyser = null;
    }
    const buf = analyser ? new Uint8Array(analyser.fftSize) : null;

    const startedAt = Date.now();
    let done = false;
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      let level = 0;
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        level = Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
      }
      levels.push(level);
      if (onLevel) onLevel(level);
      if (onTick) onTick(elapsed);
      if (elapsed >= MAX_MS && onLimit) onLimit();
    }, 50);

    recorder.start(250);

    function cleanup() {
      done = true;
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    }

    return {
      stop() {
        return new Promise((resolve, reject) => {
          if (done) return reject(new Error("Already stopped."));
          const duration = Math.round((Date.now() - startedAt) / 100) / 10;
          recorder.onstop = async () => {
            cleanup();
            if (duration < 0.6) return reject(new Error("Hold on a little longer to record a voice note."));
            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
            try {
              const audio = await toDataUrl(blob);
              if (audio.length > MAX_DATA_URL) return reject(new Error("That voice note is too long to send. Try a shorter one."));
              resolve({ audio, mime: blob.type, duration, peaks: downsample(levels) });
            } catch (err) {
              reject(err);
            }
          };
          try {
            recorder.requestData();
          } catch {}
          recorder.stop();
        });
      },
      cancel() {
        if (done) return;
        recorder.onstop = cleanup;
        try {
          recorder.stop();
        } catch {
          cleanup();
        }
      },
    };
  }

  // ---------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------
  function fmt(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function playerHtml(m) {
    const peaks = Array.isArray(m.peaks) && m.peaks.length ? m.peaks : new Array(BARS).fill(0.3);
    return `
      <div class="voice" data-voice="${UI.escape(m.id)}" ${Media.attrs(m.audio, "audio")} style="--progress:0">
        <button type="button" class="voice__play" aria-label="Play voice note">${UI.icon("play")}${UI.icon("pause")}</button>
        <div class="voice__wave" role="slider" aria-label="Voice note position" aria-valuemin="0" aria-valuemax="${Math.round(m.duration || 0)}" aria-valuenow="0" tabindex="0">
          ${peaks.map((p, i) => `<span style="--h:${p};--i:${i / peaks.length}"></span>`).join("")}
        </div>
        <span class="voice__time">${fmt(m.duration)}</span>
        <button type="button" class="voice__speed" aria-label="Playback speed">1×</button>
      </div>`;
  }

  const audio = new Audio();
  audio.preload = "auto";
  let currentId = null;
  let currentEl = null;
  let raf = null;
  let speed = 1;

  function paint() {
    if (!currentEl || !document.contains(currentEl)) return;
    const d = audio.duration && isFinite(audio.duration) ? audio.duration : Number(currentEl.dataset.duration || 0);
    const p = d ? Math.min(1, audio.currentTime / d) : 0;
    currentEl.style.setProperty("--progress", p);
    currentEl.querySelector(".voice__time").textContent = fmt(audio.paused && p === 0 ? d : audio.currentTime);
    currentEl.querySelector(".voice__wave").setAttribute("aria-valuenow", String(Math.round(audio.currentTime)));
  }
  function loop() {
    paint();
    if (!audio.paused) raf = requestAnimationFrame(loop);
  }
  function setPlaying(el, on) {
    if (!el) return;
    el.classList.toggle("voice--playing", on);
    el.querySelector(".voice__play").setAttribute("aria-label", on ? "Pause voice note" : "Play voice note");
  }

  audio.addEventListener("ended", () => {
    setPlaying(currentEl, false);
    if (currentEl) currentEl.style.setProperty("--progress", 0);
    audio.currentTime = 0;
    paint();
  });
  audio.addEventListener("pause", () => setPlaying(currentEl, false));
  audio.addEventListener("play", () => {
    setPlaying(currentEl, true);
    cancelAnimationFrame(raf);
    loop();
  });

  function find(container, id) {
    return container.querySelector(`.voice[data-voice="${CSS.escape(id)}"]`);
  }

  function toggle(container, id, getMessage) {
    const el = find(container, id);
    if (!el) return;
    if (currentId === id) {
      currentEl = el;
      if (audio.paused) audio.play().catch(() => Toast.show("Couldn't play that voice note."));
      else audio.pause();
      return;
    }
    const m = getMessage(id);
    if (!m || !m.audio) return;
    const start = (src) => {
      if (!src) return Toast.show("Couldn't load that voice note. Check your connection.");
      if (currentEl) {
        setPlaying(currentEl, false);
        currentEl.style.setProperty("--progress", 0);
      }
      currentId = id;
      currentEl = el;
      el.dataset.duration = m.duration || 0;
      audio.src = src;
      audio.playbackRate = speed;
      audio.play().catch(() => Toast.show("This phone can't play that voice note format."));
    };
    // Usually already fetched when it scrolled into view, so playback
    // starts straight from the tap (iPhones require that).
    const ready = Media.peek(m.audio);
    if (ready) start(ready);
    else {
      el.classList.add("voice--loading");
      Media.load(m.audio).then((src) => {
        el.classList.remove("voice--loading");
        start(src);
      });
    }
  }

  function seek(container, id, ratio, getMessage) {
    if (currentId !== id) {
      toggle(container, id, getMessage);
    }
    const apply = () => {
      const d = audio.duration && isFinite(audio.duration) ? audio.duration : 0;
      if (d) audio.currentTime = Math.max(0, Math.min(d - 0.05, ratio * d));
      paint();
    };
    if (audio.readyState >= 1) apply();
    else audio.addEventListener("loadedmetadata", apply, { once: true });
  }

  /** Wire up all players inside `container` (event delegation). */
  function bind(container, getMessage) {
    container.addEventListener("click", (e) => {
      const el = e.target.closest(".voice");
      if (!el) return;
      const id = el.dataset.voice;
      if (e.target.closest(".voice__play")) {
        toggle(container, id, getMessage);
      } else if (e.target.closest(".voice__speed")) {
        speed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
        audio.playbackRate = speed;
        container.querySelectorAll(".voice__speed").forEach((b) => (b.textContent = `${speed}×`));
      } else if (e.target.closest(".voice__wave")) {
        const wave = el.querySelector(".voice__wave");
        const rect = wave.getBoundingClientRect();
        seek(container, id, (e.clientX - rect.left) / rect.width, getMessage);
      }
    });
    container.addEventListener("keydown", (e) => {
      const wave = e.target.closest(".voice__wave");
      if (!wave) return;
      const id = wave.closest(".voice").dataset.voice;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle(container, id, getMessage);
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && currentId === id) {
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime + (e.key === "ArrowRight" ? 5 : -5));
        paint();
      }
    });
    // Re-attach state after a re-render (new message arrives mid-playback).
    if (currentId) {
      const el = find(container, currentId);
      if (el) {
        currentEl = el;
        setPlaying(el, !audio.paused);
        paint();
      }
    }
    container.querySelectorAll(".voice__speed").forEach((b) => (b.textContent = `${speed}×`));
  }

  /** After the list is re-rendered, keep the playing note's state. */
  function restore(container) {
    if (!currentId) return;
    const el = find(container, currentId);
    if (!el) return;
    currentEl = el;
    el.dataset.duration = el.dataset.duration || 0;
    setPlaying(el, !audio.paused);
    paint();
    container.querySelectorAll(".voice__speed").forEach((b) => (b.textContent = `${speed}×`));
  }

  function stopPlayback() {
    audio.pause();
  }

  return { supported, start, playerHtml, bind, restore, stopPlayback, fmt, MAX_MS };
})();
