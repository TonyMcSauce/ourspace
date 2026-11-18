/**
 * chat.js
 * WhatsApp-inspired one-to-one chat. Talks only to storage.js for
 * persistence — never touches localStorage directly, so swapping
 * in Firestore later means changing storage.js, not this file.
 *
 * Message shape:
 *   { id, from, text, ts, status: "sent"|"delivered"|"read",
 *     image?: dataURL, hearts?: [userId] }
 */

const Chat = (() => {
  const GROUP_GAP = 4 * 60 * 1000;
  const EMOJI = [
    "❤️", "🥰", "😘", "😍", "😊", "🥺", "😂", "🤣",
    "😭", "😴", "😏", "🙄", "🤗", "😳", "😢", "😡",
    "💕", "💖", "💋", "🌹", "🔥", "✨", "🌙", "☀️",
    "👍", "🙏", "👏", "🤞", "🍜", "🍕", "☕", "🎉",
  ];

  function seedMessages() {
    const now = Date.now();
    const min = 60 * 1000;
    return [
      { id: "m1", from: "babegirl", text: "Hey baby ❤️", ts: now - 190 * min, status: "read" },
      { id: "m2", from: "tony", text: "Heyyy 😘 how was your day?", ts: now - 187 * min, status: "read" },
      { id: "m3", from: "babegirl", text: "Long 😂 I missed you though ❤️", ts: now - 184 * min, status: "read" },
      { id: "m4", from: "tony", text: "I missed you too. Did you eat?", ts: now - 182 * min, status: "read" },
      { id: "m5", from: "babegirl", text: "Not yet lol, about to now", ts: now - 179 * min, status: "read" },
      { id: "m6", from: "tony", text: "Go eat!! I'll wait", ts: now - 178 * min, status: "read" },
      { id: "m7", from: "babegirl", text: "Okay okay 😂 back in 20", ts: now - 176 * min, status: "read" },
      { id: "m8", from: "babegirl", text: "look at this", ts: now - 40 * min, status: "read" },
      { id: "m9", from: "tony", text: "hahaha that's so you", ts: now - 38 * min, status: "read", hearts: ["babegirl"] },
      { id: "m10", from: "tony", text: "Much better now ❤️", ts: now - 5 * min, status: "delivered" },
      { id: "m11", from: "babegirl", text: "Goodnight baby ❤️", ts: now - 2 * min, status: "delivered" },
    ];
  }

  function loadMessages() {
    let messages = Storage.getMessages();
    if (!Array.isArray(messages)) {
      messages = seedMessages();
      Storage.setMessages(messages);
    }
    return messages;
  }

  function saveMessages(messages) {
    return Storage.setMessages(messages);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function statusTicks(status) {
    const label = { read: "Read", delivered: "Delivered", sent: "Sent" }[status] || "Sent";
    const ticks = status === "sent" ? "✓" : "✓✓";
    const cls = status === "read" ? "msg-status msg-status--read" : "msg-status";
    return `<span class="${cls}" aria-label="${label}" title="${label}">${ticks}</span>`;
  }

  function nameOf(id, me) {
    return id === me.id ? "You" : CONFIG.users[id]?.displayName || id;
  }

  function snippet(m) {
    if (!m) return "";
    if (m.kind === "nudge") return "Thinking of you";
    if (m.kind === "voice") return `Voice note \u00B7 ${Voice.fmt(m.duration)}`;
    const text = (m.text || "").replace(/\s+/g, " ").trim();
    return text ? (text.length > 90 ? text.slice(0, 88) + "\u2026" : text) : m.image ? "Photo" : "";
  }

  function nudgeHtml(m, prev, me) {
    const newDay = !prev || UI.daysBetween(prev.ts, m.ts) !== 0;
    const who = m.from === me.id ? "You sent a heartbeat" : `${UI.escape(nameOf(m.from, me))} is thinking of you`;
    return `
      ${newDay ? `<div class="day-divider"><span>${UI.escape(UI.dayLabel(m.ts))}</span></div>` : ""}
      <div class="nudge-line" data-msg-id="${UI.escape(m.id)}">
        <span class="nudge-line__heart" aria-hidden="true">${UI.icon("us")}</span>
        <span>${who}</span>
        <span class="nudge-line__time">${formatTime(m.ts)}</span>
      </div>`;
  }

  function messageHtml(m, prev, me) {
    if (m.kind === "nudge") return nudgeHtml(m, prev, me);
    const mine = m.from === me.id;
    const newDay = !prev || UI.daysBetween(prev.ts, m.ts) !== 0;
    const isNewGroup = newDay || prev.kind === "nudge" || prev.from !== m.from || m.ts - prev.ts > GROUP_GAP;
    const hearts = Array.isArray(m.hearts) ? m.hearts : [];
    const hearted = hearts.length > 0;

    return `
      ${newDay ? `<div class="day-divider"><span>${UI.escape(UI.dayLabel(m.ts))}</span></div>` : ""}
      <div class="msg ${mine ? "msg--mine" : "msg--theirs"} ${isNewGroup ? "msg--group-start" : ""} ${hearted ? "msg--hearted" : ""}" data-msg-id="${UI.escape(m.id)}">
        <span class="msg__swipe-icon" aria-hidden="true">${UI.icon("reply")}</span>
        <div class="msg__bubble ${m.image ? "msg__bubble--image" : ""} ${m.kind === "voice" ? "msg__bubble--voice" : ""}" tabindex="0" aria-label="${mine ? "You" : "Them"}: ${UI.escape(m.text || "Photo")}. Double tap to heart, swipe right to reply.">
          ${
            m.replyTo
              ? `<button type="button" class="msg__quote" data-jump="${UI.escape(m.replyTo.id)}">
                  <span class="msg__quote-who">${UI.escape(nameOf(m.replyTo.from, me))}</span>
                  <span class="msg__quote-text">${UI.escape(m.replyTo.text || "Photo")}</span>
                </button>`
              : ""
          }
          ${m.kind === "voice" ? Voice.playerHtml(m) : ""}
          ${m.image ? `<button type="button" class="msg__image" data-open-image><img src="${UI.escape(m.image)}" alt="Shared photo" decoding="async" /></button>` : ""}
          ${m.text ? `<p class="msg__text">${UI.escape(m.text)}</p>` : ""}
          <span class="msg__meta">${formatTime(m.ts)} ${mine ? statusTicks(m.status) : ""}</span>
          ${hearted ? `<span class="msg__heart" aria-label="Hearted">❤️</span>` : ""}
        </div>
        <button type="button" class="msg__reply-btn" data-reply aria-label="Reply">${UI.icon("reply")}</button>
      </div>
    `;
  }

  function renderMessageList(container, messages, me, { stickToBottom = true } = {}) {
    if (messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">${UI.icon("chat")}</div>
          <p class="empty-state__title">Your little corner of the internet starts here.</p>
          <p class="empty-state__subtitle">Say hello. It's just the two of you.</p>
        </div>
      `;
      return;
    }
    const prevScroll = container.scrollTop;
    container.innerHTML = messages.map((m, i) => messageHtml(m, messages[i - 1], me)).join("");
    container.scrollTop = stickToBottom ? container.scrollHeight : prevScroll;
    Voice.restore(container);
    if (stickToBottom) {
      // Photos change height once decoded; keep the latest message in view.
      container.querySelectorAll(".msg__image img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", () => (container.scrollTop = container.scrollHeight), { once: true });
      });
    }
  }

  function openImage(src) {
    UI.openModal({
      variant: "modal__panel--photo",
      label: "Photo",
      content: `<img class="photo-viewer" src="${UI.escape(src)}" alt="Shared photo" />`,
    });
  }

  function render(root) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    let messages = loadMessages();

    root.innerHTML = `
      <section class="chat-view" aria-label="Chat with ${UI.escape(other.displayName)}">
        <div class="chat-wallpaper" aria-hidden="true"></div>
        <header class="chat-header">
          <div class="avatar avatar--lg ${other.id === Object.keys(CONFIG.users)[1] ? "avatar--alt" : ""}" aria-hidden="true">${UI.escape(other.avatarInitial)}<span class="avatar__presence"></span></div>
          <div class="chat-header__info">
            <h1 class="chat-header__name">${UI.escape(other.displayName)}</h1>
            <p class="chat-header__status" id="chat-status">${UI.escape(statusFor(other))}</p>
          </div>
          <button type="button" class="nudge-btn" id="nudge-btn" aria-label="Send ${UI.escape(other.displayName)} a heartbeat">
            ${UI.icon("us")}<span>Thinking of you</span>
          </button>
        </header>
        ${countdownStripHtml()}

        <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>

        <div class="chat-composer">
          <div class="popover emoji-picker" id="emoji-picker" hidden>
            ${EMOJI.map((e) => `<button type="button" class="emoji-picker__item" data-emoji="${e}" aria-label="Insert ${e}">${e}</button>`).join("")}
          </div>

          <div class="popover attach-menu" id="attach-menu" hidden>
            <button type="button" class="attach-menu__item" data-attach="photos">${UI.icon("image")}<span>Photo</span></button>
            <button type="button" class="attach-menu__item" data-attach="camera">${UI.icon("camera")}<span>Camera</span></button>
            <button type="button" class="attach-menu__item" data-attach="wallpaper">${UI.icon("wallpaper")}<span>Wallpaper</span></button>
          </div>

          <div class="reply-bar" id="reply-bar" hidden>
            <span class="reply-bar__icon" aria-hidden="true">${UI.icon("reply")}</span>
            <span class="reply-bar__body">
              <span class="reply-bar__who"></span>
              <span class="reply-bar__text"></span>
            </span>
            <button type="button" class="icon-btn icon-btn--sm" id="reply-cancel" aria-label="Cancel reply">${UI.icon("close")}</button>
          </div>
          <form class="chat-input" id="chat-input-form" autocomplete="off">
            <button type="button" class="icon-btn" id="emoji-btn" aria-label="Emoji" aria-expanded="false" aria-controls="emoji-picker">${UI.icon("smile")}</button>
            <textarea
              id="chat-textarea"
              class="chat-input__field"
              placeholder="Message ${UI.escape(other.displayName)}…"
              rows="1"
              enterkeyhint="send"
              autocapitalize="sentences"
              aria-label="Message"
            ></textarea>
            <button type="button" class="icon-btn" id="attach-btn" aria-label="Attach" aria-expanded="false" aria-controls="attach-menu">${UI.icon("clip")}</button>
            <button type="submit" class="send-btn" aria-label="Send message" hidden>${UI.icon("send")}</button>
            <button type="button" class="send-btn mic-btn" id="mic-btn" aria-label="Record a voice note">${UI.icon("mic")}</button>
          </form>
          <div class="recorder" id="recorder" hidden>
            <button type="button" class="icon-btn recorder__cancel" id="rec-cancel" aria-label="Delete recording">${UI.icon("trash")}</button>
            <span class="recorder__dot" aria-hidden="true"></span>
            <span class="recorder__time" id="rec-time" aria-live="off">0:00</span>
            <span class="recorder__hint">Recording\u2026 tap send when you're done</span>
            <span class="recorder__meter" id="rec-meter" aria-hidden="true">${"<span></span>".repeat(28)}</span>
            <button type="button" class="send-btn" id="rec-send" aria-label="Send voice note">${UI.icon("send")}</button>
          </div>
          <input type="file" accept="image/*" id="chat-photo-input" hidden />
          <input type="file" accept="image/*" capture="environment" id="chat-camera-input" hidden />
        </div>
      </section>
    `;

    const messagesEl = root.querySelector("#chat-messages");
    const form = root.querySelector("#chat-input-form");
    const textarea = root.querySelector("#chat-textarea");
    const sendBtn = form.querySelector(".send-btn");
    const attachBtn = root.querySelector("#attach-btn");
    const attachMenu = root.querySelector("#attach-menu");
    const emojiBtn = root.querySelector("#emoji-btn");
    const emojiPicker = root.querySelector("#emoji-picker");
    const photoInput = root.querySelector("#chat-photo-input");
    const cameraInput = root.querySelector("#chat-camera-input");

    Wallpaper.apply(root.querySelector(".chat-view"));
    renderMessageList(messagesEl, messages, me);

    const micBtn = root.querySelector("#mic-btn");
    function syncComposer() {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
      const hasText = textarea.value.trim().length > 0;
      // Like WhatsApp: the mic becomes the send button once you type.
      sendBtn.hidden = !hasText && Voice.supported();
      sendBtn.disabled = !hasText;
      micBtn.hidden = hasText || !Voice.supported();
    }
    syncComposer();

    function setPopover(el, btn, open) {
      el.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    }
    function closePopovers() {
      setPopover(attachMenu, attachBtn, false);
      setPopover(emojiPicker, emojiBtn, false);
    }

    function progressStatus(id) {
      // Demo-only delivery/read receipts. Re-read from storage so we
      // never overwrite messages sent after this one was queued.
      [
        ["delivered", 900],
        ["read", 2400],
      ].forEach(([status, delay]) => {
        setTimeout(() => {
          const latest = loadMessages().map((m) => (m.id === id ? { ...m, status } : m));
          saveMessages(latest);
          if (document.contains(messagesEl)) {
            messages = latest;
            renderMessageList(messagesEl, messages, me, { stickToBottom: false });
          }
        }, delay);
      });
    }

    const replyBar = root.querySelector("#reply-bar");
    let replyTo = null;
    function startReply(id) {
      const target = loadMessages().find((m) => m.id === id);
      if (!target || target.kind === "nudge") return;
      replyTo = { id: target.id, from: target.from, text: snippet(target) };
      replyBar.querySelector(".reply-bar__who").textContent = target.from === me.id ? "Replying to yourself" : `Replying to ${nameOf(target.from, me)}`;
      replyBar.querySelector(".reply-bar__text").textContent = replyTo.text;
      replyBar.hidden = false;
      textarea.focus();
    }
    function cancelReply() {
      replyTo = null;
      replyBar.hidden = true;
    }
    root.querySelector("#reply-cancel").addEventListener("click", () => {
      cancelReply();
      textarea.focus();
    });

    function send(partial) {
      const msg = { id: UI.uid("m"), from: me.id, text: "", ts: Date.now(), status: "sent", ...partial };
      if (replyTo && partial.kind !== "nudge") msg.replyTo = replyTo;
      const next = [...loadMessages(), msg];
      if (!saveMessages(next)) {
        Toast.show("Couldn't save that, the device storage is full.");
        return false;
      }
      messages = next;
      renderMessageList(messagesEl, messages, me);
      if (!Cloud.isActive()) progressStatus(msg.id);
      if (partial.kind !== "nudge") cancelReply();
      return true;
    }

    // "Thinking of you" heartbeat
    const nudgeBtn = root.querySelector("#nudge-btn");
    nudgeBtn.addEventListener("click", () => {
      if (nudgeBtn.disabled) return;
      if (!send({ kind: "nudge" })) return;
      burstHearts(nudgeBtn);
      Toast.show(`A little heartbeat is on its way to ${other.displayName}`);
      nudgeBtn.disabled = true;
      setTimeout(() => (nudgeBtn.disabled = false), 8000);
    });

    textarea.addEventListener("input", syncComposer);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) return;
      if (send({ text })) {
        textarea.value = "";
        syncComposer();
        closePopovers();
        textarea.focus();
      }
    });

    attachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = attachMenu.hidden;
      closePopovers();
      setPopover(attachMenu, attachBtn, open);
    });

    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = emojiPicker.hidden;
      closePopovers();
      setPopover(emojiPicker, emojiBtn, open);
    });

    emojiPicker.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-emoji]");
      if (!btn) return;
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, start) + emoji + textarea.value.slice(end);
      const caret = start + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
      syncComposer();
    });

    attachMenu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-attach]");
      if (!btn) return;
      closePopovers();
      const kind = btn.dataset.attach;
      if (kind === "photos") photoInput.click();
      else if (kind === "camera") {
        if (Camera.prefersNative() || !Camera.available()) cameraInput.click();
        else Camera.capture().then((file) => file && sendPhotoFile(file));
      }
      else if (kind === "wallpaper") Wallpaper.openPicker(() => Wallpaper.apply(root.querySelector(".chat-view")));
    });

    async function handlePhoto(input) {
      const file = input.files && input.files[0];
      input.value = "";
      if (file) sendPhotoFile(file);
    }
    async function sendPhotoFile(file) {
      try {
        const image = await UI.readImage(file, { maxSize: 1080, quality: 0.8 });
        const caption = textarea.value.trim();
        if (send({ image, text: caption })) {
          textarea.value = "";
          syncComposer();
        }
      } catch (err) {
        Toast.show(err.message);
      }
    }
    photoInput.addEventListener("change", () => handlePhoto(photoInput));
    cameraInput.addEventListener("change", () => handlePhoto(cameraInput));

    // Close popovers when tapping elsewhere in the chat.
    root.querySelector(".chat-view").addEventListener("click", (e) => {
      if (!e.target.closest(".popover") && !e.target.closest("#attach-btn") && !e.target.closest("#emoji-btn")) {
        closePopovers();
      }
    });
    root.querySelector(".chat-view").addEventListener("keydown", (e) => {
      if (e.key === "Escape" && (!attachMenu.hidden || !emojiPicker.hidden)) {
        closePopovers();
        textarea.focus();
      }
    });

    // Double tap / double click a bubble to heart it.
    function toggleHeart(id) {
      const latest = loadMessages().map((m) => {
        if (m.id !== id) return m;
        const hearts = Array.isArray(m.hearts) ? m.hearts : [];
        return { ...m, hearts: hearts.includes(me.id) ? hearts.filter((h) => h !== me.id) : [...hearts, me.id] };
      });
      saveMessages(latest);
      messages = latest;
      renderMessageList(messagesEl, messages, me, { stickToBottom: false });
      const bubble = messagesEl.querySelector(`[data-msg-id="${CSS.escape(id)}"] .msg__bubble`);
      if (bubble) {
        bubble.classList.add("msg__bubble--pulse");
        bubble.focus({ preventScroll: true });
      }
    }

    function jumpTo(id) {
      const row = messagesEl.querySelector(`[data-msg-id="${CSS.escape(id)}"]`);
      if (!row) {
        Toast.show("That message is no longer here.");
        return;
      }
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.remove("msg--flash");
      void row.offsetWidth;
      row.classList.add("msg--flash");
    }

    let lastTap = { id: null, time: 0 };
    messagesEl.addEventListener("click", (e) => {
      const replyBtn = e.target.closest("[data-reply]");
      if (replyBtn) {
        startReply(replyBtn.closest("[data-msg-id]").dataset.msgId);
        return;
      }
      const quote = e.target.closest("[data-jump]");
      if (quote) {
        jumpTo(quote.dataset.jump);
        return;
      }
      if (e.target.closest(".voice")) return;
      const imageBtn = e.target.closest("[data-open-image]");
      const row = e.target.closest("[data-msg-id]");
      if (!row || row.classList.contains("nudge-line")) return;
      const id = row.dataset.msgId;
      const now = Date.now();
      if (lastTap.id === id && now - lastTap.time < 320) {
        clearTimeout(lastTap.timer);
        lastTap = { id: null, time: 0 };
        toggleHeart(id);
        return;
      }
      if (imageBtn) {
        const src = imageBtn.querySelector("img").src;
        const timer = setTimeout(() => openImage(src), 330);
        lastTap = { id, time: now, timer };
        return;
      }
      lastTap = { id, time: now };
    });
    messagesEl.addEventListener("dblclick", (e) => e.preventDefault());
    messagesEl.addEventListener("keydown", (e) => {
      const row = e.target.closest("[data-msg-id]");
      if (row && (e.key === "Enter" || e.key === " ") && e.target.classList.contains("msg__bubble")) {
        e.preventDefault();
        toggleHeart(row.dataset.msgId);
      }
    });

    // Focus the composer on wider screens, where it won't pop a keyboard.
    if (window.matchMedia("(min-width: 980px)").matches) textarea.focus({ preventScroll: true });

    // Feel like a native messenger: tap or drag the conversation to put
    // the keyboard away, and give the chat the whole screen while typing.
    const touchDevice = window.matchMedia("(hover: none)").matches;
    textarea.addEventListener("focus", () => {
      if (touchDevice) document.body.classList.add("is-typing");
      requestAnimationFrame(() => (messagesEl.scrollTop = messagesEl.scrollHeight));
    });
    textarea.addEventListener("blur", () => {
      document.body.classList.remove("is-typing");
      document.documentElement.style.removeProperty("--keyboard-free");
    });
    // Fit the chat into the space above the iPhone keyboard so the
    // header never scrolls out of view.
    const vv = window.visualViewport;
    if (vv && touchDevice) {
      const fit = () => {
        if (!document.contains(messagesEl)) {
          vv.removeEventListener("resize", fit);
          vv.removeEventListener("scroll", fit);
          return;
        }
        if (!document.body.classList.contains("is-typing")) return;
        const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
        document.documentElement.style.setProperty("--keyboard-free", `${vv.height}px`);
        window.scrollTo(0, 0);
        if (nearBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
      };
      vv.addEventListener("resize", fit);
      vv.addEventListener("scroll", fit);
    }
    // Composer buttons must not steal focus from the text box, otherwise
    // the keyboard drops and the layout jumps mid-tap (send, emoji,
    // attach, cancel reply all keep the keyboard up, like Messages).
    root.querySelectorAll(".chat-input button, #reply-cancel").forEach((btn) =>
      btn.addEventListener("mousedown", (e) => e.preventDefault())
    );
    const dismissKeyboard = () => {
      if (document.activeElement === textarea) textarea.blur();
    };
    let dragStartY = null;
    messagesEl.addEventListener("touchstart", (e) => (dragStartY = e.touches[0].clientY), { passive: true });
    messagesEl.addEventListener(
      "touchmove",
      (e) => {
        if (dragStartY !== null && e.touches[0].clientY - dragStartY > 14) {
          dragStartY = null;
          dismissKeyboard();
        }
      },
      { passive: true }
    );
    messagesEl.addEventListener("click", (e) => {
      if (!e.target.closest("[data-reply], [data-jump], [data-open-image]")) dismissKeyboard();
    });

    // Voice notes: tap the mic, talk, then send or bin it.
    Voice.bind(messagesEl, (id) => loadMessages().find((m) => m.id === id));
    const composer = root.querySelector(".chat-composer");
    const recorderEl = root.querySelector("#recorder");
    const recTime = root.querySelector("#rec-time");
    const meterBars = Array.from(root.querySelectorAll("#rec-meter span"));
    let recording = null;
    let meter = [];

    function showRecorder(on) {
      recorderEl.hidden = !on;
      composer.classList.toggle("chat-composer--recording", on);
      if (!on) {
        meter = [];
        meterBars.forEach((b) => b.style.setProperty("--h", 0.08));
        recTime.textContent = "0:00";
      }
    }

    async function startRecording() {
      if (recording) return;
      textarea.blur();
      closePopovers();
      Voice.stopPlayback();
      showRecorder(true);
      try {
        recording = await Voice.start({
          onLevel: (level) => {
            meter.push(level);
            if (meter.length > meterBars.length) meter.shift();
            const offset = meterBars.length - meter.length;
            meterBars.forEach((bar, i) => bar.style.setProperty("--h", Math.max(0.08, meter[i - offset] || 0)));
          },
          onTick: (ms) => (recTime.textContent = Voice.fmt(ms / 1000)),
          onLimit: () => finishRecording(),
        });
        if (!document.contains(recorderEl)) {
          recording.cancel();
          recording = null;
        } else if (navigator.vibrate) navigator.vibrate(15);
      } catch (err) {
        showRecorder(false);
        Toast.show(err.message);
      }
    }

    async function finishRecording() {
      if (!recording) return;
      const rec = recording;
      recording = null;
      try {
        const note = await rec.stop();
        send({ kind: "voice", ...note });
      } catch (err) {
        Toast.show(err.message);
      } finally {
        showRecorder(false);
      }
    }

    function cancelRecording() {
      if (!recording) return;
      recording.cancel();
      recording = null;
      showRecorder(false);
    }

    micBtn.addEventListener("click", startRecording);
    root.querySelector("#rec-send").addEventListener("click", finishRecording);
    root.querySelector("#rec-cancel").addEventListener("click", cancelRecording);
    recorderEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cancelRecording();
    });
    window.addEventListener("hashchange", cancelRecording, { once: true });

    // Swipe a bubble to the right to reply (touch screens).
    let swipe = null;
    messagesEl.addEventListener(
      "touchstart",
      (e) => {
        const row = e.target.closest(".msg");
        if (!row || e.touches.length !== 1) return;
        swipe = { row, x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, locked: null };
      },
      { passive: true }
    );
    messagesEl.addEventListener(
      "touchmove",
      (e) => {
        if (!swipe) return;
        const dx = e.touches[0].clientX - swipe.x;
        const dy = e.touches[0].clientY - swipe.y;
        if (swipe.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) swipe.locked = Math.abs(dx) > Math.abs(dy) && dx > 0;
        if (!swipe.locked) return;
        swipe.dx = Math.max(0, Math.min(84, dx * 0.6));
        swipe.row.style.setProperty("--swipe", `${swipe.dx}px`);
        swipe.row.classList.add("msg--swiping");
        swipe.row.classList.toggle("msg--swipe-ready", swipe.dx > 52);
      },
      { passive: true }
    );
    const endSwipe = () => {
      if (!swipe) return;
      const { row, dx } = swipe;
      row.classList.remove("msg--swiping", "msg--swipe-ready");
      row.style.removeProperty("--swipe");
      if (dx > 52) {
        if (navigator.vibrate) navigator.vibrate(10);
        startReply(row.dataset.msgId);
      }
      swipe = null;
    };
    messagesEl.addEventListener("touchend", endSwipe);
    messagesEl.addEventListener("touchcancel", endSwipe);

    // Live updates from the other person (cloud mode).
    const statusEl = root.querySelector("#chat-status");
    const presenceDot = root.querySelector(".avatar__presence");
    function paintPresence() {
      statusEl.textContent = statusFor(other);
      if (presenceDot) presenceDot.hidden = Cloud.isActive() && !isOnline(other);
    }
    paintPresence();
    const presenceTimer = setInterval(() => {
      if (!document.contains(messagesEl)) return clearInterval(presenceTimer);
      paintPresence();
    }, 30 * 1000);

    const off = Storage.onChange((kind) => {
      if (!document.contains(messagesEl)) {
        off();
        clearInterval(presenceTimer);
        return;
      }
      if (kind === "presence") paintPresence();
      if (kind === "wallpaper") Wallpaper.apply(root.querySelector(".chat-view"));
      if (kind === "countdown") {
        const strip = root.querySelector(".countdown-strip");
        const fresh = document.createElement("div");
        fresh.innerHTML = countdownStripHtml();
        if (strip) strip.replaceWith(...fresh.childNodes);
        else root.querySelector(".chat-header").after(...fresh.childNodes);
      }
      if (kind !== "messages") return;
      const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 120;
      messages = loadMessages();
      renderMessageList(messagesEl, messages, me, { stickToBottom: nearBottom });
    });
    markSeen();
  }

  // ---------------------------------------------------------------
  // Countdown strip, heart burst, incoming heartbeat
  // ---------------------------------------------------------------
  function countdownStripHtml() {
    const c = Countdown.describe();
    if (!c || c.past) return "";
    return `
      <a class="countdown-strip" href="#/us">
        <span class="countdown-strip__when">${UI.escape(c.short)}</span>
        <span class="countdown-strip__what">until ${UI.escape(c.title)}</span>
      </a>`;
  }

  function burstHearts(from) {
    const rect = from.getBoundingClientRect();
    for (let i = 0; i < 7; i++) {
      const h = document.createElement("span");
      h.className = "heart-burst";
      h.innerHTML = UI.icon("us");
      h.style.left = `${rect.left + rect.width / 2}px`;
      h.style.top = `${rect.top + rect.height / 2}px`;
      h.style.setProperty("--dx", `${(Math.random() - 0.5) * 140}px`);
      h.style.setProperty("--dy", `${-60 - Math.random() * 110}px`);
      h.style.setProperty("--r", `${(Math.random() - 0.5) * 60}deg`);
      h.style.animationDelay = `${i * 45}ms`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  }

  const NUDGE_SEEN_KEY = "ourspace_nudge_seen";
  function showHeartbeat(from) {
    if (document.querySelector(".heartbeat")) return;
    const el = document.createElement("div");
    el.className = "heartbeat";
    el.setAttribute("role", "alert");
    el.innerHTML = `
      <div class="heartbeat__seal seal" aria-hidden="true">${UI.icon("us")}</div>
      <p class="heartbeat__text"><em>${UI.escape(from.displayName)}</em> is thinking of you</p>
      <p class="heartbeat__hint">Tap anywhere</p>`;
    const close = () => {
      el.classList.add("heartbeat--leaving");
      setTimeout(() => el.remove(), 400);
    };
    el.addEventListener("click", close);
    document.body.appendChild(el);
    if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
    setTimeout(close, 5200);
  }

  function checkIncomingNudges() {
    if (!Cloud.isActive() || document.body.classList.contains("is-locked")) return;
    const me = Auth.currentUser();
    if (!me) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(NUDGE_SEEN_KEY) || 0);
    } catch {}
    const fresh = loadMessages().filter((m) => m.kind === "nudge" && m.from !== me.id && m.ts > seen && Date.now() - m.ts < 10 * 60 * 1000);
    const newest = loadMessages().reduce((t, m) => (m.kind === "nudge" && m.from !== me.id ? Math.max(t, m.ts) : t), seen);
    try {
      localStorage.setItem(NUDGE_SEEN_KEY, String(newest));
    } catch {}
    if (fresh.length && document.visibilityState === "visible") showHeartbeat(CONFIG.users[fresh[fresh.length - 1].from]);
  }

  // ---------------------------------------------------------------
  // Presence and receipts (cloud mode)
  // ---------------------------------------------------------------
  const ONLINE_WINDOW = 2 * 60 * 1000;

  function isOnline(user) {
    const seen = Storage.getPresence()[user.id];
    return Boolean(seen && Date.now() - seen < ONLINE_WINDOW);
  }

  function statusFor(user) {
    if (!Cloud.isActive()) return user.statusText;
    const seen = Storage.getPresence()[user.id];
    if (!seen) return "not here yet";
    if (Date.now() - seen < ONLINE_WINDOW) return "online";
    const when = new Date(seen);
    const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const day = UI.dayLabel(seen);
    return day === "Today" ? `last seen today at ${time}` : day === "Yesterday" ? `last seen yesterday at ${time}` : `last seen ${day.toLowerCase()}`;
  }

  /**
   * Messages from the other person become "delivered" as soon as this
   * device receives them, and "read" while the chat is open and visible.
   */
  function markSeen() {
    if (!Cloud.isActive()) return;
    const me = Auth.currentUser();
    if (!me) return;
    const viewing = Router.current() === "chat" && document.visibilityState === "visible";
    let changed = false;
    const next = loadMessages().map((m) => {
      if (m.from === me.id) return m;
      const target = viewing ? "read" : m.status === "sent" ? "delivered" : m.status;
      if (target === m.status || (m.status === "read" && target !== "read")) return m;
      changed = true;
      return { ...m, status: target };
    });
    if (changed) saveMessages(next);
  }

  Storage.onChange((kind) => {
    if (kind === "messages") {
      markSeen();
      checkIncomingNudges();
    }
  });
  document.addEventListener("visibilitychange", checkIncomingNudges);
  document.addEventListener("visibilitychange", markSeen);

  return { render, loadMessages, checkIncomingNudges };
})();

Router.register("chat", Chat.render);
