/**
 * countdown.js
 * "Next time together": one shared countdown, shown big on the Us page
 * and as a slim strip under the chat header.
 *
 * Shape: { title, date: "YYYY-MM-DD", time: "HH:MM" | "" }
 */

const Countdown = (() => {
  const HOUR = 60 * 60 * 1000;

  function get() {
    const c = Storage.getCountdown();
    return c && c.title && c.date ? c : null;
  }

  function target(c) {
    const d = UI.parseLocalDate(c.date);
    if (c.time && /^\d{2}:\d{2}$/.test(c.time)) {
      const [h, m] = c.time.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    }
    return d;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /** Everything the views need, or null when nothing is set. */
  function describe() {
    const c = get();
    if (!c) return null;
    const when = target(c);
    const diff = when - Date.now();
    const sameDay = UI.daysBetween(new Date(), when) === 0;
    const base = { title: c.title, date: c.date, time: c.time || "", when };

    if (diff <= 0) {
      return sameDay
        ? { ...base, today: true, past: false, number: "Today", unit: "", rest: "", short: "Today" }
        : { ...base, past: true };
    }
    const days = Math.floor(diff / UI.DAY);
    const hours = Math.floor((diff % UI.DAY) / HOUR);
    const mins = Math.max(1, Math.floor((diff % HOUR) / 60000));
    if (days >= 1) {
      return { ...base, past: false, number: String(days), unit: days === 1 ? "day" : "days", rest: plural(hours, "hour", "hours"), short: plural(days, "day", "days") };
    }
    if (hours >= 1) {
      return { ...base, past: false, number: String(hours), unit: hours === 1 ? "hour" : "hours", rest: plural(mins, "minute", "minutes"), short: `${hours}h ${mins}m` };
    }
    return { ...base, past: false, number: String(mins), unit: mins === 1 ? "minute" : "minutes", rest: "", short: plural(mins, "min", "min") };
  }

  function whenLabel(c) {
    const date = UI.formatLongDate(c.date);
    if (!c.time) return date;
    const t = target(c).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${date} · ${t}`;
  }

  function cardHtml() {
    const c = describe();
    if (!c || c.past) {
      return `
        <button type="button" class="countdown countdown--empty" id="edit-countdown">
          <span class="countdown__label">Next time together</span>
          <span class="countdown__empty-title">${c && c.past ? `Hope ${UI.escape(c.title)} was lovely.` : "Something to look forward to?"}</span>
          <span class="countdown__empty-cta">${UI.icon("plus")} ${c && c.past ? "Set the next one" : "Start a countdown"}</span>
        </button>`;
    }
    return `
      <div class="countdown" id="countdown-card">
        <div class="countdown__top">
          <span class="countdown__label">Next time together</span>
          <button type="button" class="btn btn--text" id="edit-countdown">${UI.icon("edit")} Edit</button>
        </div>
        <p class="countdown__title">${UI.escape(c.title)}</p>
        <p class="countdown__value">
          ${c.today ? `<span class="countdown__number">It's today</span>` : `<span class="countdown__in">in</span> <span class="countdown__number">${c.number}</span> <span class="countdown__unit">${c.unit}</span>`}
        </p>
        <p class="countdown__meta">${c.rest && !c.today ? `and ${UI.escape(c.rest)} · ` : ""}${UI.escape(whenLabel(c))}</p>
      </div>`;
  }

  function openEditor(onChange) {
    const c = get() || { title: "", date: "", time: "" };
    const today = UI.toInputDate(new Date());
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Next time together",
      content: `
        <h2 class="modal__title">Next time <em>together</em></h2>
        <form class="form" id="countdown-form" novalidate>
          <label class="field">
            <span class="field__label">What are you counting down to?</span>
            <input class="field__input" name="title" maxlength="60" value="${UI.escape(c.title)}" placeholder="Lisbon weekend" autofocus />
          </label>
          <div class="field-row">
            <label class="field">
              <span class="field__label">Date</span>
              <input class="field__input" type="date" name="date" min="${today}" value="${UI.escape(c.date >= today ? c.date : "")}" />
            </label>
            <label class="field">
              <span class="field__label">Time <span class="field__optional">optional</span></span>
              <input class="field__input" type="time" name="time" value="${UI.escape(c.time || "")}" />
            </label>
          </div>
          <p class="form__error" id="countdown-error" role="alert" hidden></p>
          <div class="modal__actions">
            ${get() ? `<button type="button" class="btn btn--text btn--text-danger modal__actions-left" data-clear>Remove</button>` : ""}
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Save</button>
          </div>
        </form>`,
    });
    const form = panel.querySelector("#countdown-form");
    const error = panel.querySelector("#countdown-error");
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    const clear = panel.querySelector("[data-clear]");
    if (clear) {
      clear.addEventListener("click", () => {
        Storage.setCountdown({ title: "", date: "", time: "" });
        UI.closeModal();
        onChange();
      });
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const next = {
        title: String(data.get("title") || "").trim(),
        date: String(data.get("date") || ""),
        time: String(data.get("time") || ""),
      };
      let problem = "";
      if (!next.title) problem = "Give it a name, like “our Lisbon weekend”.";
      else if (!next.date) problem = "Pick the date.";
      else if (next.date < today) problem = "Pick a date from today onwards.";
      if (problem) {
        error.textContent = problem;
        error.hidden = false;
        return;
      }
      Storage.setCountdown(next);
      UI.closeModal();
      onChange();
      Toast.show("Countdown started ❤️");
    });
  }

  return { describe, cardHtml, openEditor };
})();
