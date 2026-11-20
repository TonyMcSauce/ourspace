/**
 * wallpaper.js
 * Chat wallpapers: eight designs drawn in code (crisp, tiny, themed for
 * light and dark) or your own photo with adjustable dim and blur.
 *
 * Each phone keeps its own choice. "Set for both of us" also saves it
 * to the shared space; whichever choice is newest wins on each phone,
 * so you can still change yours afterwards.
 *
 * Record shape: { id, photo?, dim?, blur?, at, by? }
 */

const Wallpaper = (() => {
  const svg = (markup, w, h) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${markup}</svg>`)}")`;

  function palette() {
    const dark = ThemeManager.current() === "dark";
    return dark
      ? { dark, ink: "239,230,214", wax: "239,106,79", rose: "201,120,140", paper: "#141110" }
      : { dark, ink: "34,26,21", wax: "214,69,58", rose: "217,154,165", paper: "#fbf7f1" };
  }
  const rgba = (rgb, a) => `rgba(${rgb},${a})`;

  const HEART = "M12 20s-8.5-5.2-8.5-11.4A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3c0 6.2-8.5 11.4-8.5 11.4Z";

  const DESIGNS = [
    { id: "paper", name: "Paper", paint: () => ({}) },
    {
      id: "letter",
      name: "Letter",
      paint: (p) => ({
        image: `linear-gradient(90deg, transparent 34px, ${rgba(p.wax, 0.28)} 34px, ${rgba(p.wax, 0.28)} 35px, transparent 35px), repeating-linear-gradient(transparent 0 31px, ${rgba(p.ink, p.dark ? 0.12 : 0.1)} 31px 32px)`,
      }),
    },
    {
      id: "linen",
      name: "Linen",
      paint: (p) => ({
        image: `repeating-linear-gradient(0deg, ${rgba(p.ink, 0.05)} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${rgba(p.ink, 0.04)} 0 1px, transparent 1px 3px), radial-gradient(120% 80% at 50% 0%, ${rgba(p.ink, 0.04)}, transparent)`,
      }),
    },
    {
      id: "hearts",
      name: "Hearts",
      paint: (p) => ({
        image: svg(
          `<g fill='${rgba(p.wax, p.dark ? 0.16 : 0.13)}'>
             <path d='${HEART}' transform='translate(8 8) scale(.9)'/>
             <path d='${HEART}' transform='translate(52 50) rotate(-14 12 12) scale(.75)'/>
           </g>
           <g fill='none' stroke='${rgba(p.wax, p.dark ? 0.2 : 0.16)}' stroke-width='1.2'>
             <path d='${HEART}' transform='translate(50 4) rotate(12 12 12) scale(.6)'/>
             <path d='${HEART}' transform='translate(6 54) rotate(-8 12 12) scale(.6)'/>
           </g>`,
          88,
          88
        ),
        size: "88px 88px",
      }),
    },
    {
      id: "flowers",
      name: "Pressed flowers",
      paint: (p) => {
        const c = rgba(p.ink, p.dark ? 0.22 : 0.2);
        const w = rgba(p.wax, p.dark ? 0.28 : 0.22);
        const sprig = (x, y, r) => `
          <g transform='translate(${x} ${y}) rotate(${r})' fill='none' stroke='${c}' stroke-width='1.1' stroke-linecap='round'>
            <path d='M0 70 C4 46 2 24 10 0'/>
            <path d='M2 50 c-12 -4 -16 -12 -14 -18 c8 2 13 8 14 18z'/>
            <path d='M4 34 c10 -6 18 -6 22 -2 c-6 6 -14 6 -22 2z'/>
            <g transform='translate(10 0)' stroke='${w}'>
              ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx='0' cy='-6' rx='3.6' ry='6' transform='rotate(${a})'/>`).join("")}
              <circle r='1.8'/>
            </g>
          </g>`;
        return { image: svg(sprig(30, 40, -12) + sprig(130, 120, 24) + sprig(150, 10, 160), 200, 200), size: "200px 200px" };
      },
    },
    {
      id: "night",
      name: "Night sky",
      deep: true,
      paint: () => {
        let stars = "";
        let seed = 7;
        const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 46; i++) {
          const r = rnd() < 0.12 ? 1.3 : rnd() < 0.5 ? 0.8 : 0.55;
          stars += `<circle cx='${(rnd() * 240).toFixed(1)}' cy='${(rnd() * 240).toFixed(1)}' r='${r}' fill='rgba(255,246,230,${(0.35 + rnd() * 0.6).toFixed(2)})'/>`;
        }
        return {
          color: "#110e17",
          image: `${svg(stars, 240, 240)}, radial-gradient(120% 70% at 80% 0%, rgba(120,70,110,.35), transparent 60%), radial-gradient(90% 60% at 0% 100%, rgba(200,56,42,.18), transparent 60%), linear-gradient(#17121f, #0d0b12)`,
          size: "240px 240px, cover, cover, cover",
        };
      },
    },
    {
      id: "watercolour",
      name: "Watercolour",
      paint: (p) => ({
        image: `radial-gradient(55% 40% at 12% 18%, ${rgba(p.wax, p.dark ? 0.2 : 0.16)}, transparent 70%), radial-gradient(45% 35% at 88% 38%, ${rgba(p.rose, p.dark ? 0.22 : 0.3)}, transparent 70%), radial-gradient(65% 45% at 35% 92%, ${rgba(p.wax, p.dark ? 0.14 : 0.12)}, transparent 70%), radial-gradient(40% 30% at 75% 80%, ${rgba(p.rose, p.dark ? 0.16 : 0.22)}, transparent 70%)`,
        size: "cover",
        fixed: true,
      }),
    },
    {
      id: "postmarks",
      name: "Postmarks",
      paint: (p) => {
        const c = rgba(p.ink, p.dark ? 0.17 : 0.13);
        const w = rgba(p.wax, p.dark ? 0.22 : 0.16);
        const mark = (x, y, r) => `
          <g transform='translate(${x} ${y}) rotate(${r})' fill='none' stroke='${c}' stroke-width='1.2'>
            <circle r='24'/><circle r='19'/>
            <text y='4' text-anchor='middle' font-family='Georgia,serif' font-size='9' fill='${c}' stroke='none' letter-spacing='1'>US</text>
            <path d='M28 -10 q8 -6 16 0 t16 0 t16 0 M28 -2 q8 -6 16 0 t16 0 t16 0 M28 6 q8 -6 16 0 t16 0 t16 0'/>
          </g>`;
        const stamp = (x, y, r) => `
          <g transform='translate(${x} ${y}) rotate(${r})' fill='none' stroke='${w}' stroke-width='1.2'>
            <rect width='34' height='42' stroke-dasharray='2 2.2'/>
            <path d='M17 30s-7-4.3-7-9.4a4 4 0 0 1 7-2.5a4 4 0 0 1 7 2.5c0 5.1-7 9.4-7 9.4Z' fill='${w}' stroke='none'/>
          </g>`;
        return { image: svg(mark(50, 50, -14) + stamp(170, 30, 8) + mark(170, 170, 10) + stamp(36, 150, -10), 240, 240), size: "240px 240px" };
      },
    },
  ];

  function byId(id) {
    return DESIGNS.find((d) => d.id === id) || DESIGNS[0];
  }

  /** The wallpaper this phone should show right now. */
  function current() {
    const local = Storage.getWallpaperLocal();
    const shared = Cloud.isActive() ? Storage.getWallpaperShared() : null;
    const pick = [local, shared].filter((w) => w && w.id).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
    return pick || { id: "paper" };
  }

  function nameOf(w) {
    return w.id === "photo" ? "Your photo" : byId(w.id).name;
  }

  /** Paint a wallpaper onto `view` (which holds a .chat-wallpaper layer). */
  function paint(view, w) {
    const layer = view.querySelector(".chat-wallpaper");
    if (!layer) return;
    const isPhoto = w.id === "photo" && w.photo;
    const design = isPhoto ? null : byId(w.id);
    const look = design ? design.paint(palette()) : {};
    layer.style.backgroundColor = look.color || "";
    layer.style.backgroundImage = look.image || "";
    layer.style.backgroundSize = look.size || "";
    layer.style.backgroundAttachment = "";
    layer.innerHTML = isPhoto ? `<span class="chat-wallpaper__photo" ${Media.attrs(w.photo, "bg")}></span>` : "";
    if (isPhoto) Media.hydrate(layer);
    view.style.setProperty("--wp-dim", String(isPhoto ? (w.dim ?? 0.35) : 0));
    view.style.setProperty("--wp-blur", `${isPhoto ? (w.blur ?? 6) : 0}px`);
    view.classList.toggle("chat-view--photo", Boolean(isPhoto));
    view.classList.toggle("chat-view--deep", Boolean(isPhoto || (design && design.deep)));
    view.dataset.wallpaper = isPhoto ? "photo" : design.id;
  }

  function apply(view) {
    paint(view, current());
  }

  // ---------------------------------------------------------------
  // Picker
  // ---------------------------------------------------------------
  function previewMessagesHtml() {
    const me = Auth.currentUser();
    const sample = Chat.loadMessages().filter((m) => m.kind !== "nudge" && m.text).slice(-4);
    const list = sample.length
      ? sample
      : [
          { from: Auth.otherUser().id, text: "How does this look?" },
          { from: me.id, text: "Perfect. Just like you." },
        ];
    return list
      .map(
        (m) => `
        <div class="msg ${m.from === me.id ? "msg--mine" : "msg--theirs"} msg--group-start">
          <div class="msg__bubble"><p class="msg__text">${UI.escape(m.text.length > 70 ? m.text.slice(0, 68) + "…" : m.text)}</p></div>
        </div>`
      )
      .join("");
  }

  function openPicker(onDone) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    let draft = { ...current() };
    let shareBoth = false;

    const panel = UI.openModal({
      variant: "modal__panel--wallpaper",
      label: "Chat wallpaper",
      content: `
        <h2 class="modal__title">Chat <em>wallpaper</em></h2>
        <div class="wp-preview chat-view" id="wp-preview">
          <div class="chat-wallpaper"></div>
          <div class="wp-preview__msgs chat-messages">${previewMessagesHtml()}</div>
        </div>

        <div class="wp-grid" role="radiogroup" aria-label="Wallpapers">
          ${DESIGNS.map(
            (d) => `
            <button type="button" class="wp-swatch" role="radio" data-id="${d.id}" aria-label="${UI.escape(d.name)}">
              <span class="wp-swatch__art chat-view"><span class="chat-wallpaper"></span></span>
              <span class="wp-swatch__name">${UI.escape(d.name)}</span>
            </button>`
          ).join("")}
          <label class="wp-swatch wp-swatch--photo" data-id="photo">
            <input type="file" accept="image/*" class="visually-hidden" id="wp-photo-input" />
            <span class="wp-swatch__art chat-view"><span class="chat-wallpaper"></span><span class="wp-swatch__add">${UI.icon("image")}</span></span>
            <span class="wp-swatch__name">Your photo</span>
          </label>
        </div>

        <div class="wp-adjust" id="wp-adjust" hidden>
          <label class="wp-slider">
            <span class="field__label">Dim</span>
            <input type="range" min="0" max="0.7" step="0.05" id="wp-dim" />
          </label>
          <label class="wp-slider">
            <span class="field__label">Blur</span>
            <input type="range" min="0" max="20" step="1" id="wp-blur" />
          </label>
        </div>

        ${
          Cloud.isActive()
            ? `<label class="wp-share">
                <input type="checkbox" id="wp-share" />
                <span class="wp-share__box" aria-hidden="true"></span>
                <span><strong>Set for both of us</strong><br /><span class="field__hint">${UI.escape(other.displayName)} will see it too, and can still change theirs.</span></span>
              </label>`
            : ""
        }
        <p class="form__error" id="wp-error" role="alert" hidden></p>
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
          <button type="button" class="btn btn--primary" data-save>Save</button>
        </div>`,
    });

    const preview = panel.querySelector("#wp-preview");
    const adjust = panel.querySelector("#wp-adjust");
    const dim = panel.querySelector("#wp-dim");
    const blur = panel.querySelector("#wp-blur");
    const error = panel.querySelector("#wp-error");
    const photoInput = panel.querySelector("#wp-photo-input");
    const photoSwatch = panel.querySelector(".wp-swatch--photo");

    // Paint every swatch with its own design.
    panel.querySelectorAll(".wp-swatch[data-id]").forEach((sw) => {
      const id = sw.dataset.id;
      if (id === "photo") return;
      paint(sw.querySelector(".wp-swatch__art"), { id });
    });
    let lastPhoto = draft.id === "photo" ? draft.photo : (Storage.getWallpaperLocal() || {}).photo || null;
    if (lastPhoto) paint(photoSwatch.querySelector(".wp-swatch__art"), { id: "photo", photo: lastPhoto, dim: 0.1, blur: 0 });
    photoSwatch.classList.toggle("wp-swatch--has-photo", Boolean(lastPhoto));

    function refresh() {
      paint(preview, draft);
      panel.querySelectorAll(".wp-swatch").forEach((sw) => {
        const on = sw.dataset.id === draft.id;
        sw.classList.toggle("wp-swatch--active", on);
        sw.setAttribute("aria-checked", String(on));
      });
      adjust.hidden = draft.id !== "photo";
      photoSwatch.querySelector(".wp-swatch__name").textContent = draft.id === "photo" ? "Change photo" : "Your photo";
      if (draft.id === "photo") {
        dim.value = String(draft.dim ?? 0.35);
        blur.value = String(draft.blur ?? 6);
      }
    }
    refresh();

    panel.querySelector(".wp-grid").addEventListener("click", (e) => {
      const sw = e.target.closest(".wp-swatch[data-id]");
      if (!sw || sw.dataset.id === "photo") return;
      draft = { id: sw.dataset.id };
      refresh();
    });
    photoSwatch.addEventListener("click", (e) => {
      // Re-select an existing photo without reopening the picker.
      if (lastPhoto && draft.id !== "photo" && !e.target.closest("input")) {
        e.preventDefault();
        draft = { id: "photo", photo: lastPhoto, dim: 0.35, blur: 6 };
        refresh();
      }
    });
    photoInput.addEventListener("change", async () => {
      const file = photoInput.files && photoInput.files[0];
      photoInput.value = "";
      if (!file) return;
      try {
        const photo = await UI.readImage(file, { maxSize: 1280, quality: 0.8 });
        lastPhoto = photo;
        paint(photoSwatch.querySelector(".wp-swatch__art"), { id: "photo", photo, dim: 0.1, blur: 0 });
        photoSwatch.classList.add("wp-swatch--has-photo");
        draft = { id: "photo", photo, dim: 0.35, blur: 6 };
        error.hidden = true;
        refresh();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
    dim.addEventListener("input", () => {
      draft.dim = Number(dim.value);
      paint(preview, draft);
    });
    blur.addEventListener("input", () => {
      draft.blur = Number(blur.value);
      paint(preview, draft);
    });
    const share = panel.querySelector("#wp-share");
    if (share) share.addEventListener("change", () => (shareBoth = share.checked));

    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    panel.querySelector("[data-save]").addEventListener("click", () => {
      const record = { ...draft, at: Date.now(), by: me.id };
      if (record.id !== "photo") {
        delete record.photo;
        delete record.dim;
        delete record.blur;
      }
      if (!Storage.setWallpaperLocal(record)) {
        error.textContent = "That photo is too big for this phone's storage. Try another one.";
        error.hidden = false;
        return;
      }
      if (shareBoth) {
        // Share the photo through the media store, not inside the setting.
        const shared = { ...record };
        if (shared.photo) {
          try {
            shared.photo = Media.store(shared.photo);
          } catch {
            delete shared.photo;
          }
        }
        Storage.setWallpaperShared(shared);
      }
      UI.closeModal();
      if (onDone) onDone();
      Toast.show(shareBoth ? `New wallpaper for you and ${other.displayName} ❤️` : "Wallpaper saved.");
    });
  }

  return { apply, current, nameOf, openPicker };
})();
