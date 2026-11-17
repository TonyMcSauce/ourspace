/**
 * journey.js
 * Relationship timeline + live duration counter.
 * Rendered inside the "Us" page (us.js) rather than as its own nav
 * tab, since the four-item nav is Chat / Notes / Memories / Us.
 *
 * Event shape: { id, icon, label, date: "YYYY-MM-DD" }
 * A "Today" marker is always appended at render time, never stored.
 */

const Journey = (() => {
  const ICONS = ["❤️", "✨", "✈️", "🏠", "📸", "🎂", "💍", "🎉", "🌹", "🐾", "🎵", "🌍"];

  // Older versions stored display strings ("June 2025"). Map the
  // original seed events onto real dates so they sort correctly.
  const LEGACY_DATES = { j1: Storage.getStartDate(), j2: "2025-06-14", j3: "2026-01-18" };

  function seedEvents() {
    return [
      { id: "j1", icon: "❤️", label: "We became official", date: Storage.getStartDate() },
      { id: "j2", icon: "✈️", label: "Our first trip together", date: "2025-06-14" },
      { id: "j3", icon: "📸", label: "One of our favourite memories", date: "2026-01-18" },
    ];
  }

  function loadEvents() {
    let events = Storage.getJourney();
    if (!Array.isArray(events)) {
      events = seedEvents();
      Storage.setJourney(events);
      return events;
    }
    let migrated = false;
    events = events
      .filter((ev) => {
        const isOldTodayMarker = ev.id === "j4" && !UI.isIsoDate(ev.date);
        if (isOldTodayMarker) migrated = true;
        return !isOldTodayMarker;
      })
      .map((ev) => {
        if (!UI.isIsoDate(ev.date) && LEGACY_DATES[ev.id]) {
          migrated = true;
          return { ...ev, date: LEGACY_DATES[ev.id] };
        }
        return ev;
      });
    if (migrated) Storage.setJourney(events);
    return events;
  }

  function saveEvents(events) {
    const ok = Storage.setJourney(events);
    if (!ok) Toast.show("Couldn't save that milestone.");
    return ok;
  }

  function sortedEvents(events) {
    return [...events].sort((a, b) => {
      const ad = UI.isIsoDate(a.date), bd = UI.isIsoDate(b.date);
      if (ad && bd) return a.date.localeCompare(b.date);
      return ad ? -1 : bd ? 1 : 0;
    });
  }

  function computeDuration(startDateISO) {
    const start = UI.parseLocalDate(String(startDateISO).slice(0, 10)) || new Date(startDateISO);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    let days = now.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    return { years, months, days };
  }

  function totalDays() {
    return UI.daysBetween(UI.parseLocalDate(Storage.getStartDate()), new Date());
  }

  function nextAnniversary() {
    const start = UI.parseLocalDate(Storage.getStartDate());
    const today = UI.startOfDay(new Date());
    let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return { date: next, inDays: UI.daysBetween(today, next), years: next.getFullYear() - start.getFullYear() };
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function counterHtml() {
    const { years, months, days } = computeDuration(Storage.getStartDate());
    const anniv = nextAnniversary();
    const annivText =
      anniv.inDays === 0
        ? `Happy ${ordinal(anniv.years)} anniversary, today.`
        : `${ordinal(anniv.years)} anniversary in ${anniv.inDays} ${anniv.inDays === 1 ? "day" : "days"}.`;
    const part = (n, one, many) => `<span><b>${n}</b> ${n === 1 ? one : many}</span>`;
    return `
      <button type="button" class="counter" id="journey-counter" aria-label="Together for ${totalDays()} days: ${years} years, ${months} months and ${days} days">
        <span class="counter__label">Together for</span>
        <span class="counter__number">${totalDays().toLocaleString()}</span>
        <span class="counter__unit">days</span>
        <span class="counter__breakdown">
          ${part(years, "year", "years")}
          ${part(months, "month", "months")}
          ${part(days, "day", "days")}
        </span>
        <span class="counter__next">${annivText}</span>
      </button>
    `;
  }

  function shortDate(value) {
    if (!UI.isIsoDate(value)) return UI.escape(value);
    const d = UI.parseLocalDate(value);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }

  function timelineHtml(events) {
    const items = sortedEvents(events)
      .map(
        (ev, i) => `
        <li class="ledger__row" style="animation-delay:${i * 60}ms">
          <span class="ledger__date">${shortDate(ev.date)}</span>
          <span class="ledger__label"><span class="ledger__icon" aria-hidden="true">${UI.escape(ev.icon)}</span>${UI.escape(ev.label)}</span>
          <button type="button" class="ledger__remove icon-btn icon-btn--sm" data-remove-event="${UI.escape(ev.id)}" aria-label="Remove ${UI.escape(ev.label)}">${UI.icon("close")}</button>
        </li>`
      )
      .join("");
    return `
      <ol class="ledger">
        ${items}
        <li class="ledger__row ledger__row--now">
          <span class="ledger__date">Today</span>
          <span class="ledger__label"><span class="ledger__now-dot" aria-hidden="true"></span>Still writing it</span>
        </li>
      </ol>
    `;
  }

  function openAddMilestone(onChange) {
    const panel = UI.openModal({
      variant: "modal__panel--form",
      label: "Add a milestone",
      content: `
        <h2 class="modal__title">Add a milestone</h2>
        <form class="form" id="milestone-form" novalidate>
          <fieldset class="field">
            <legend class="field__label">Icon</legend>
            <div class="icon-picker">
              ${ICONS.map(
                (ic, i) => `<label class="icon-picker__item"><input type="radio" name="icon" value="${ic}" ${i === 0 ? "checked" : ""} /><span>${ic}</span></label>`
              ).join("")}
            </div>
          </fieldset>
          <label class="field">
            <span class="field__label">What happened?</span>
            <input class="field__input" name="label" maxlength="70" placeholder="Moved in together" required autofocus />
          </label>
          <label class="field">
            <span class="field__label">When</span>
            <input class="field__input" type="date" name="date" value="${UI.toInputDate(new Date())}" required />
          </label>
          <p class="form__error" id="milestone-error" role="alert" hidden></p>
          <div class="modal__actions">
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary">Add to our story</button>
          </div>
        </form>
      `,
    });
    const form = panel.querySelector("#milestone-form");
    const error = panel.querySelector("#milestone-error");
    panel.querySelector("[data-cancel]").addEventListener("click", UI.closeModal);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const label = String(data.get("label") || "").trim();
      const date = String(data.get("date") || "");
      if (!label || !date) {
        error.textContent = !label ? "Give this milestone a name." : "Pick a date.";
        error.hidden = false;
        return;
      }
      if (!saveEvents([...loadEvents(), { id: UI.uid("j"), icon: String(data.get("icon")), label, date }])) return;
      UI.closeModal();
      onChange();
      Toast.show("Added to your story ❤️");
    });
  }

  function attachInteractions(root, onChange) {
    const counter = root.querySelector("#journey-counter");
    if (counter) {
      counter.addEventListener("click", () => {
        counter.classList.remove("counter--pulse");
        void counter.offsetWidth; // restart the animation on repeat clicks
        counter.classList.add("counter--pulse");
      });
    }
    root.querySelectorAll("[data-remove-event]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = btn.dataset.removeEvent;
        const ev = loadEvents().find((x) => x.id === id);
        if (!ev) return;
        const ok = await UI.confirm({
          title: "Remove this milestone?",
          message: `“${ev.label}” will be taken off your timeline.`,
          confirmLabel: "Remove",
          danger: true,
        });
        if (!ok) return;
        saveEvents(loadEvents().filter((x) => x.id !== id));
        onChange();
      })
    );
  }

  return {
    counterHtml,
    timelineHtml,
    loadEvents,
    attachInteractions,
    openAddMilestone,
    computeDuration,
    totalDays,
    nextAnniversary,
  };
})();
