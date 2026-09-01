/**
 * journey.js
 * Relationship timeline + live duration counter.
 * Rendered inside the "Us" page (us.js) rather than as its own nav
 * tab, since the brief's four-item bottom nav is Chat / Notes /
 * Memories / Us — Journey and Us naturally live together as one
 * scrollable couple-profile experience.
 */

const Journey = (() => {
  function seedEvents() {
    return [
      { id: "j1", icon: "\u2764\uFE0F", label: "We became official", date: "14 February 2024" },
      { id: "j2", icon: "\u2708\uFE0F", label: "Our first trip together", date: "June 2025" },
      { id: "j3", icon: "\uD83D\uDCF8", label: "One of our favourite memories", date: "2026" },
      { id: "j4", icon: "\u2764\uFE0F", label: "Today", date: "Still going" },
    ];
  }

  function loadEvents() {
    let events = Storage.getJourney();
    if (!events) {
      events = seedEvents();
      Storage.setJourney(events);
    }
    return events;
  }

  function computeDuration(startDateISO) {
    const start = new Date(startDateISO);
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

  function counterHtml() {
    const { years, months, days } = computeDuration(CONFIG.relationshipStartDate);
    return `
      <div class="journey-counter" id="journey-counter">
        <p class="journey-counter__label">Together for</p>
        <div class="journey-counter__digits">
          <div class="journey-counter__unit">
            <span class="journey-counter__number">${years}</span>
            <span class="journey-counter__word">${years === 1 ? "Year" : "Years"}</span>
          </div>
          <div class="journey-counter__unit">
            <span class="journey-counter__number">${months}</span>
            <span class="journey-counter__word">${months === 1 ? "Month" : "Months"}</span>
          </div>
          <div class="journey-counter__unit">
            <span class="journey-counter__number">${days}</span>
            <span class="journey-counter__word">${days === 1 ? "Day" : "Days"}</span>
          </div>
        </div>
      </div>
    `;
  }

  function timelineHtml(events) {
    return `
      <ol class="timeline">
        ${events
          .map(
            (ev, i) => `
          <li class="timeline__item" style="animation-delay:${i * 90}ms">
            <span class="timeline__icon">${ev.icon}</span>
            <div class="timeline__content">
              <p class="timeline__label"></p>
              <p class="timeline__date">${ev.date}</p>
            </div>
          </li>
        `
          )
          .join("")}
      </ol>
    `;
  }

  function attachInteractions(root) {
    const counter = root.querySelector("#journey-counter");
    if (!counter) return;
    counter.addEventListener("click", () => {
      counter.classList.remove("journey-counter--pulse");
      // Force reflow so the animation can restart on repeat clicks.
      void counter.offsetWidth;
      counter.classList.add("journey-counter--pulse");
    });
  }

  function hydrateLabels(root, events) {
    events.forEach((ev, i) => {
      const item = root.querySelectorAll(".timeline__item")[i];
      if (item) item.querySelector(".timeline__label").textContent = ev.label;
    });
  }

  return { counterHtml, timelineHtml, loadEvents, attachInteractions, hydrateLabels, computeDuration };
})();
