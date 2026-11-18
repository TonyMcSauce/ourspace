/**
 * camera.js
 * In-app camera for laptops and desktops, where the browser ignores the
 * "capture" hint and would otherwise open a file picker. Phones keep
 * using their native camera, which is better there.
 *
 * Camera.capture() resolves with an image File, or null if cancelled.
 */

const Camera = (() => {
  function prefersNative() {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  function available() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function friendlyError(err) {
    const name = err && err.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "Camera access is off. Allow it in your browser's site settings to take photos.";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device.";
    if (name === "NotReadableError") return "The camera is in use by another app.";
    return "Couldn't open the camera.";
  }

  function capture() {
    return new Promise((resolve) => {
      let stream = null;
      let facing = "user";
      let settled = false;
      let shot = null;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        resolve(value);
      };

      const panel = UI.openModal({
        variant: "modal__panel--camera",
        label: "Camera",
        onClose: () => finish(null),
        content: `
          <div class="camera">
            <div class="camera__stage">
              <video class="camera__video" playsinline autoplay muted></video>
              <img class="camera__still" alt="Your photo" hidden />
              <p class="camera__status" role="status">Opening the camera…</p>
            </div>
            <div class="camera__bar">
              <button type="button" class="camera__side" data-flip hidden aria-label="Switch camera">${UI.icon("flip")}</button>
              <button type="button" class="camera__shutter" data-shoot aria-label="Take photo" disabled><span></span></button>
              <span class="camera__side camera__side--spacer"></span>
            </div>
            <div class="camera__bar camera__bar--review" hidden>
              <button type="button" class="btn btn--ghost camera__btn" data-retake>Retake</button>
              <button type="button" class="btn btn--primary camera__btn" data-use>Send photo</button>
            </div>
          </div>`,
      });

      const video = panel.querySelector(".camera__video");
      const still = panel.querySelector(".camera__still");
      const status = panel.querySelector(".camera__status");
      const shutter = panel.querySelector("[data-shoot]");
      const flip = panel.querySelector("[data-flip]");
      const shootBar = panel.querySelector(".camera__bar:not(.camera__bar--review)");
      const reviewBar = panel.querySelector(".camera__bar--review");

      async function open() {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        shutter.disabled = true;
        status.hidden = false;
        status.textContent = "Opening the camera…";
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        } catch (err) {
          status.textContent = friendlyError(err);
          return;
        }
        if (settled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        const settings = (track && track.getSettings && track.getSettings()) || {};
        video.classList.toggle("camera__video--mirror", settings.facingMode !== "environment");
        try {
          await video.play();
        } catch {}
        status.hidden = true;
        shutter.disabled = false;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          flip.hidden = devices.filter((d) => d.kind === "videoinput").length < 2;
        } catch {}
      }

      function take() {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        // The live preview is mirrored like a mirror, but the photo is
        // saved the right way round so any writing reads correctly.
        canvas.getContext("2d").drawImage(video, 0, 0, w, h);
        panel.querySelector(".camera__stage").classList.add("camera__stage--flash");
        setTimeout(() => panel.querySelector(".camera__stage").classList.remove("camera__stage--flash"), 300);
        canvas.toBlob(
          (blob) => {
            if (!blob) return;
            shot = new File([blob], "photo.jpg", { type: "image/jpeg" });
            still.src = URL.createObjectURL(blob);
            still.hidden = false;
            video.hidden = true;
            shootBar.hidden = true;
            reviewBar.hidden = false;
          },
          "image/jpeg",
          0.9
        );
      }

      shutter.addEventListener("click", take);
      flip.addEventListener("click", () => {
        facing = facing === "user" ? "environment" : "user";
        open();
      });
      panel.querySelector("[data-retake]").addEventListener("click", () => {
        if (still.src) URL.revokeObjectURL(still.src);
        shot = null;
        still.hidden = true;
        video.hidden = false;
        shootBar.hidden = false;
        reviewBar.hidden = true;
      });
      panel.querySelector("[data-use]").addEventListener("click", () => {
        const file = shot;
        finish(file);
        UI.closeModal();
      });
      panel.addEventListener("keydown", (e) => {
        if ((e.key === " " || e.key === "Enter") && !shutter.disabled && !shootBar.hidden && e.target.tagName !== "BUTTON") {
          e.preventDefault();
          take();
        }
      });

      open();
    });
  }

  return { prefersNative, available, capture };
})();
