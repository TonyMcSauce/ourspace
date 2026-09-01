/**
 * chat.js
 * WhatsApp-inspired one-to-one chat. Talks only to storage.js for
 * persistence — never touches localStorage directly, so swapping
 * in Firestore later means changing storage.js, not this file.
 */

const Chat = (() => {
  function seedMessages() {
    const now = Date.now();
    const min = 60 * 1000;
    return [
      { id: "m1", from: "babegirl", text: "Hey baby \u2764\uFE0F", ts: now - 190 * min, status: "read" },
      { id: "m2", from: "tony", text: "Heyyy \uD83D\uDE18 how was your day?", ts: now - 187 * min, status: "read" },
      { id: "m3", from: "babegirl", text: "Long \uD83D\uDE02 I missed you though \u2764\uFE0F", ts: now - 184 * min, status: "read" },
      { id: "m4", from: "tony", text: "I missed you too. Did you eat?", ts: now - 182 * min, status: "read" },
      { id: "m5", from: "babegirl", text: "Not yet lol, about to now", ts: now - 179 * min, status: "read" },
      { id: "m6", from: "tony", text: "Go eat!! I'll wait", ts: now - 178 * min, status: "read" },
      { id: "m7", from: "babegirl", text: "Okay okay \uD83D\uDE02 back in 20", ts: now - 176 * min, status: "read" },
      { id: "m8", from: "babegirl", text: "look at this", ts: now - 40 * min, status: "read" },
      { id: "m9", from: "tony", text: "hahaha that's so you", ts: now - 38 * min, status: "read" },
      { id: "m10", from: "tony", text: "Much better now \u2764\uFE0F", ts: now - 5 * min, status: "delivered" },
      { id: "m11", from: "babegirl", text: "Goodnight baby \u2764\uFE0F", ts: now - 2 * min, status: "delivered" },
    ];
  }

  function loadMessages() {
    let messages = Storage.getMessages();
    if (!messages) {
      messages = seedMessages();
      Storage.setMessages(messages);
    }
    return messages;
  }

  function saveMessages(messages) {
    Storage.setMessages(messages);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function statusTicks(status) {
    if (status === "read") return '<span class="msg-status msg-status--read">\u2713\u2713</span>';
    if (status === "delivered") return '<span class="msg-status">\u2713\u2713</span>';
    return '<span class="msg-status">\u2713</span>';
  }

  function groupsWithMeta(messages) {
    // Mark which messages start a new "group" (different sender or >4min gap)
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const isNewGroup = !prev || prev.from !== m.from || m.ts - prev.ts > 4 * 60 * 1000;
      return { ...m, isNewGroup };
    });
  }

  function messageBubbleHtml(m, me) {
    const mine = m.from === me.id;
    const senderClass = mine ? "msg--mine" : "msg--theirs";
    const groupClass = m.isNewGroup ? "msg--group-start" : "";
    return `
      <div class="msg ${senderClass} ${groupClass}" data-msg-id="${m.id}">
        <div class="msg__bubble">
          <p class="msg__text"></p>
          <span class="msg__meta">${formatTime(m.ts)} ${mine ? statusTicks(m.status) : ""}</span>
        </div>
      </div>
    `;
  }

  function renderMessageList(container, messages, me) {
    const grouped = groupsWithMeta(messages);
    if (grouped.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">\u2764\uFE0F</div>
          <p class="empty-state__title">Your little corner of the internet starts here.</p>
          <p class="empty-state__subtitle">Send the first message.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = grouped.map((m) => messageBubbleHtml(m, me)).join("");
    // Set text content via textContent to avoid any HTML injection from demo/user text
    grouped.forEach((m) => {
      const el = container.querySelector(`[data-msg-id="${m.id}"] .msg__text`);
      if (el) el.textContent = m.text;
    });
    container.scrollTop = container.scrollHeight;
  }

  function render(root) {
    const me = Auth.currentUser();
    const other = Auth.otherUser();
    let messages = loadMessages();

    root.innerHTML = `
      <section class="chat-view" aria-label="Chat with ${other.displayName}">
        <header class="chat-header">
          <div class="chat-header__avatar" aria-hidden="true">${other.avatarInitial}</div>
          <div class="chat-header__info">
            <h1 class="chat-header__name">${other.displayName}</h1>
            <p class="chat-header__status">${other.statusText}</p>
          </div>
        </header>

        <div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>

        <form class="chat-input" id="chat-input-form" autocomplete="off">
          <button type="button" class="icon-btn" id="emoji-btn" aria-label="Add emoji">\uD83D\uDE0A</button>
          <textarea
            id="chat-textarea"
            class="chat-input__field"
            placeholder="Type a message\u2026"
            rows="1"
            aria-label="Message"
          ></textarea>
          <button type="button" class="icon-btn" id="attach-btn" aria-label="Attach">\uD83D\uDCCE</button>
          <button type="submit" class="send-btn" aria-label="Send message">\u27A4</button>
        </form>

        <div class="attach-menu" id="attach-menu" hidden>
          <button type="button" class="attach-menu__item" data-attach="photos">\uD83D\uDDBC\uFE0F Photos <span>Coming soon</span></button>
          <button type="button" class="attach-menu__item" data-attach="camera">\uD83D\uDCF7 Camera <span>Coming soon</span></button>
          <button type="button" class="attach-menu__item" data-attach="voice">\uD83C\uDF99\uFE0F Voice message <span>Coming soon</span></button>
        </div>
      </section>
    `;

    const messagesEl = root.querySelector("#chat-messages");
    const form = root.querySelector("#chat-input-form");
    const textarea = root.querySelector("#chat-textarea");
    const attachBtn = root.querySelector("#attach-btn");
    const attachMenu = root.querySelector("#attach-menu");
    const emojiBtn = root.querySelector("#emoji-btn");

    renderMessageList(messagesEl, messages, me);

    // Auto-grow textarea, cap at a few lines
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 110) + "px";
    });

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) return;

      const newMessage = {
        id: `m${Date.now()}`,
        from: me.id,
        text,
        ts: Date.now(),
        status: "sent",
      };
      messages = [...messages, newMessage];
      saveMessages(messages);
      renderMessageList(messagesEl, messages, me);

      textarea.value = "";
      textarea.style.height = "auto";
      textarea.focus();

      // Simulate delivery/read receipts for realism, demo-only.
      setTimeout(() => {
        messages = messages.map((m) => (m.id === newMessage.id ? { ...m, status: "delivered" } : m));
        saveMessages(messages);
        renderMessageList(messagesEl, messages, me);
      }, 900);
      setTimeout(() => {
        messages = messages.map((m) => (m.id === newMessage.id ? { ...m, status: "read" } : m));
        saveMessages(messages);
        renderMessageList(messagesEl, messages, me);
      }, 2200);
    });

    attachBtn.addEventListener("click", () => {
      attachMenu.hidden = !attachMenu.hidden;
    });

    attachMenu.querySelectorAll(".attach-menu__item").forEach((btn) => {
      btn.addEventListener("click", () => {
        attachMenu.hidden = true;
        Toast.show("This feature is coming in a future version \u2764\uFE0F");
      });
    });

    emojiBtn.addEventListener("click", () => {
      const quick = ["\u2764\uFE0F", "\uD83D\uDE18", "\uD83D\uDE02", "\uD83D\uDE0D", "\uD83D\uDE22", "\uD83D\uDD25"];
      const pick = quick[Math.floor(Math.random() * quick.length)];
      textarea.value += pick;
      textarea.focus();
    });
  }

  return { render, loadMessages };
})();

Router.register("chat", Chat.render);
