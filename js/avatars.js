/**
 * avatars.js
 * Profile pictures: one helper draws every avatar in the app (photo, or
 * initials as a fallback), a circular cropper sets your own, and
 * changes from the other phone appear everywhere at once.
 *
 * Photos are small (320px JPEG, ~25 KB) and kept in one shared settings
 * document, so they're instant everywhere without extra downloads.
 */

const Avatars = (() => {
  const OUT = 320;

  function photoOf(id) {
    return Media.safe((Storage.getAvatars() || {})[id]);
  }

  function isAlt(id) {
    return id === Object.keys(CONFIG.users)[1];
  }

  function inner(user) {
    const photo = photoOf(user.id);
    return photo ? `<img class="avatar__img" src="${UI.escape(photo)}" alt="" decoding="async" />` : UI.escape(user.avatarInitial);
  }

  /** Markup for a user's avatar. `extra` is appended inside (e.g. presence dot). */
  function html(user, size = "", extra = "", attrs = "") {
    if (!user) return "";
    const photo = photoOf(user.id);
    return `<span class="avatar ${size} ${isAlt(user.id) ? "avatar--alt" : ""} ${photo ? "avatar--photo" : ""}" data-avatar="${UI.escape(user.id)}" ${attrs}>${inner(user)}${extra}</span>`;
  }

  /** Redraw every avatar on screen, keeping extras like the presence dot. */
  function refresh() {
    document.querySelectorAll("[data-avatar]").forEach((el) => {
      const user = CONFIG.users[el.getAttribute("data-avatar")];
      if (!user) return;
      const keep = Array.from(el.children).filter((c) => !c.classList.contains("avatar__img"));
      el.innerHTML = inner(user);
      keep.forEach((c) => el.appendChild(c));
      el.classList.toggle("avatar--photo", Boolean(photoOf(user.id)));
    });
  }

  Storage.onChange((kind) => {
    if (kind === "avatars") refresh();
  });

  // ---------------------------------------------------------------
  // Cropper
  // ---------------------------------------------------------------
  function openEditor() {
    const me = Auth.currentUser();
    const current = photoOf(me.id);
    let img = null;
    let base = 1;
    let zoom = 1;
    let x = 0;
    let y = 0;

    const panel = UI.openModal({
      variant: "modal__panel--form modal__panel--avatar",
      label: "Profile photo",
      content: `
        <h2 class="modal__title">Your <em>photo</em></h2>
        <div class="cropper" id="cropper">
          <img class="cropper__img" alt="" draggable="false" hidden />
          <div class="cropper__ring" aria-hidden="true"></div>
          <label class="cropper__empty">
            <input type="file" accept="image/*" class="visually-hidden" data-pick />
            ${Avatars.html(me, "avatar--xxl")}
            <span class="cropper__cta">${UI.icon("camera")} Choose a photo</span>
          </label>
        </div>
        <p class="cropper__hint" id="cropper-hint" hidden>Drag to position · pinch or slide to zoom</p>
        <label class="cropper__zoom" id="cropper-zoom" hidden>
          <span aria-hidden="true">${UI.icon("image")}</span>
          <input type="range" min="1" max="3" step="0.01" value="1" aria-label="Zoom" />
          <span aria-hidden="true" class="cropper__zoom-big">${UI.icon("image")}</span>
        </label>
        <p class="form__error" id="avatar-error" role="alert" hidden></p>
        <div class="modal__actions">
          ${current ? `<button type="button" class="btn btn--text btn--text-danger modal__actions-left" data-remove>Remove</button>` : ""}
          <label class="btn btn--ghost" id="avatar-change" hidden><input type="file" accept="image/*" class="visually-hidden" data-pick />Change</label>
          <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
          <button type="button" class="btn btn--primary" data-save disabled>Save</button>
        </div>`,
    });

    const box = panel.querySelector("#cropper");
    const imgEl = panel.querySelector(".cropper__img");
    const empty = panel.querySelector(".cropper__empty");
    const zoomWrap = panel.querySelector("#cropper-zoom");
    const zoomInput = zoomWrap.querySelector("input");
    const error = panel.querySelector("#avatar-error");
    const save = panel.querySelector("[data-save]");

    const size = () => box.clientWidth;
    function clamp() {
      const s = base * zoom;
      const mx = Math.max(0, (img.naturalWidth * s - size()) / 2);
      const my = Math.max(0, (img.naturalHeight * s - size()) / 2);
      x = Math.max(-mx, Math.min(mx, x));
      y = Math.max(-my, Math.min(my, y));
    }
    function paint() {
      if (!img) return;
      clamp();
      imgEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${base * zoom})`;
    }

    async function choose(file) {
      if (!file) return;
      try {
        const data = await UI.readImage(file, { maxSize: 1400, quality: 0.9 });
        const el = new Image();
        el.onload = () => {
          img = el;
          imgEl.src = data;
          imgEl.width = el.naturalWidth;
          imgEl.height = el.naturalHeight;
          base = Math.max(size() / el.naturalWidth, size() / el.naturalHeight);
          zoom = 1;
          x = 0;
          y = 0;
          zoomInput.value = "1";
          imgEl.hidden = false;
          empty.hidden = true;
          zoomWrap.hidden = false;
          panel.querySelector("#cropper-hint").hidden = false;
          panel.querySelector("#avatar-change").hidden = false;
          box.classList.add("cropper--active");
          save.disabled = false;
          error.hidden = true;
          paint();
        };
        el.src = data;
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    }
    panel.querySelectorAll("[data-pick]").forEach((input) =>
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        input.value = "";
        choose(file);
      })
    );

    // Drag with one finger/mouse; pinch with two fingers; wheel on laptops.
    const pointers = new Map();
    let pinch = null;
    box.addEventListener("pointerdown", (e) => {
      if (!img) return;
      box.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    });
    box.addEventListener("pointermove", (e) => {
      if (!img || !pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        zoom = Math.max(1, Math.min(3, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d));
        zoomInput.value = String(zoom);
      } else if (pointers.size === 1) {
        x += e.clientX - prev.x;
        y += e.clientY - prev.y;
      }
      paint();
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
    };
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    box.addEventListener(
      "wheel",
      (e) => {
        if (!img) return;
        e.preventDefault();
        zoom = Math.max(1, Math.min(3, zoom - e.deltaY * 0.002));
        zoomInput.value = String(zoom);
        paint();
      },
      { passive: false }
    );
    zoomInput.addEventListener("input", () => {
      zoom = Number(zoomInput.value);
      paint();
    });

    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    const remove = panel.querySelector("[data-remove]");
    if (remove)
      remove.addEventListener("click", () => {
        const next = { ...(Storage.getAvatars() || {}) };
        delete next[me.id];
        Storage.setAvatars(next);
        refresh();
        UI.closeModal();
        Toast.show("Photo removed.");
      });

    save.addEventListener("click", () => {
      if (!img) return;
      const s = base * zoom;
      const k = OUT / size();
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const g = canvas.getContext("2d");
      g.imageSmoothingQuality = "high";
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      g.drawImage(img, (size() / 2 + x - w / 2) * k, (size() / 2 + y - h / 2) * k, w * k, h * k);
      const data = canvas.toDataURL("image/jpeg", 0.86);
      Storage.setAvatars({ ...(Storage.getAvatars() || {}), [me.id]: data });
      refresh();
      UI.closeModal();
      Toast.show("Looking good ❤️");
    });
  }

  return { html, refresh, openEditor, photoOf };
})();
