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

  function messageHtml(m, prev, me) {
    const mine = m.from === me.id;
    const newDay = !prev || UI.daysBetween(prev.ts, m.ts) !== 0;
    const isNewGroup = newDay || prev.from !== m.from || m.ts - prev.ts > GROUP_GAP;
    const hearts = Array.isArray(m.hearts) ? m.hearts : [];
    const hearted = hearts.length > 0;

    return `
      ${newDay ? `<div class="day-divider"><span>${UI.escape(UI.dayLabel(m.ts))}</span></div>` : ""}
      <div class="msg ${mine ? "msg--mine" : "msg--theirs"} ${isNewGroup ? "msg--group-start" : ""} ${hearted ? "msg--hearted" : ""}" data-msg-id="${UI.escape(m.id)}">
        <div class="msg__bubble ${m.image ? "msg__bubble--image" : ""}" tabindex="0" aria-label="${mine ? "You" : "Them"}: ${UI.escape(m.text || "Photo")}. Double tap to heart.">
          ${m.image ? `<button type="button" class="msg__image" data-open-image><img src="${UI.escape(m.image)}" alt="Shared photo" decoding="async" /></button>` : ""}
          ${m.text ? `<p class="msg__text">${UI.escape(m.text)}</p>` : ""}
          <span class="msg__meta">${formatTime(m.ts)} ${mine ? statusTicks(m.status) : ""}</span>
          ${hearted ? `<span class="msg__heart" aria-label="Hearted">❤️</span>` : ""}
        </div>
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
        <header class="chat-header">
          <div class="avatar avatar--lg ${other.id === Object.keys(CONFIG.users)[1] ? "avatar--alt" : ""}" aria-hidden="true">${UI.escape(other.avatarInitial)}<span class="avatar__presence"></span></div>
          <div class="chat-header__info">
            <h1 class="chat-header__name">${UI.escape(other.displayName)}</h1>
            <p class="chat-header__status">${UI.escape(other.statusText)}</p>
          </div>
        </header>

        <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>

        <div class="chat-composer">
          <div class="popover emoji-picker" id="emoji-picker" hidden>
            ${EMOJI.map((e) => `<button type="button" class="emoji-picker__item" data-emoji="${e}" aria-label="Insert ${e}">${e}</button>`).join("")}
          </div>

          <div class="popover attach-menu" id="attach-menu" hidden>
            <button type="button" class="attach-menu__item" data-attach="photos">${UI.icon("image")}<span>Photo</span></button>
            <button type="button" class="attach-menu__item" data-attach="camera">${UI.icon("camera")}<span>Camera</span></button>
            <button type="button" class="attach-menu__item" data-attach="voice">${UI.icon("mic")}<span>Voice note</span><em>Soon</em></button>
          </div>

          <form class="chat-input" id="chat-input-form" autocomplete="off">
            <button type="button" class="icon-btn" id="emoji-btn" aria-label="Emoji" aria-expanded="false" aria-controls="emoji-picker">${UI.icon("smile")}</button>
            <textarea
              id="chat-textarea"
              class="chat-input__field"
              placeholder="Message ${UI.escape(other.displayName)}…"
              rows="1"
              aria-label="Message"
            ></textarea>
            <button type="button" class="icon-btn" id="attach-btn" aria-label="Attach" aria-expanded="false" aria-controls="attach-menu">${UI.icon("clip")}</button>
            <button type="submit" class="send-btn" aria-label="Send message" disabled>${UI.icon("send")}</button>
          </form>
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

    renderMessageList(messagesEl, messages, me);

    function syncComposer() {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
      sendBtn.disabled = textarea.value.trim().length === 0;
    }

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

    function send(partial) {
      const msg = { id: UI.uid("m"), from: me.id, text: "", ts: Date.now(), status: "sent", ...partial };
      const next = [...loadMessages(), msg];
      if (!saveMessages(next)) {
        Toast.show("Couldn't save that, the device storage is full.");
        return false;
      }
      messages = next;
      renderMessageList(messagesEl, messages, me);
      progressStatus(msg.id);
      return true;
    }

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
      else if (kind === "camera") cameraInput.click();
      else Toast.show("Voice notes are on the way ❤️");
    });

    async function handlePhoto(input) {
      const file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
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

    let lastTap = { id: null, time: 0 };
    messagesEl.addEventListener("click", (e) => {
      const imageBtn = e.target.closest("[data-open-image]");
      const row = e.target.closest("[data-msg-id]");
      if (!row) return;
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
  }

  return { render, loadMessages };
})();

Router.register("chat", Chat.render);
