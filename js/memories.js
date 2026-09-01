/**
 * memories.js
 * Photo/memory gallery. Uses gradient placeholders in V1 instead of
 * real images (no external image APIs). Each memory's `gradient`
 * field would become an image URL from Firebase Storage in V2.
 */

const Memories = (() => {
  function seedMemories() {
    return [
      {
        id: "mem1",
        title: "That weekend \u2764\uFE0F",
        date: "March 2025",
        caption: "We didn't leave the couch once and it was perfect.",
        gradient: "linear-gradient(135deg, #7a2439, #c98a9c)",
      },
      {
        id: "mem2",
        title: "Random Sunday",
        date: "January 2026",
        caption: "No plans, just us and bad reality TV.",
        gradient: "linear-gradient(135deg, #3a2036, #8a5a6b)",
      },
      {
        id: "mem3",
        title: "Our first trip",
        date: "June 2025",
        caption: "Got lost twice, laughed the whole time.",
        gradient: "linear-gradient(135deg, #5c1f2e, #e0a5ab)",
      },
      {
        id: "mem4",
        title: "One of my favourite days",
        date: "October 2025",
        caption: "Nothing special happened. That's why it was special.",
        gradient: "linear-gradient(135deg, #2b1b2e, #a15c6e)",
      },
      {
        id: "mem5",
        title: "Late night drive",
        date: "August 2025",
        caption: "Windows down, your playlist, no destination.",
        gradient: "linear-gradient(135deg, #6b2337, #d99aa5)",
      },
      {
        id: "mem6",
        title: "Sunday breakfast",
        date: "February 2026",
        caption: "You burnt the pancakes. I still ate three.",
        gradient: "linear-gradient(135deg, #451826, #b97684)",
      },
    ];
  }

  function loadMemories() {
    let memories = Storage.getMemories();
    if (!memories) {
      memories = seedMemories();
      Storage.setMemories(memories);
    }
    return memories;
  }

  function cardHtml(mem) {
    return `
      <button type="button" class="memory-card" data-memory-id="${mem.id}" style="background:${mem.gradient}">
        <span class="memory-card__overlay">
          <span class="memory-card__title"></span>
          <span class="memory-card__date">${mem.date}</span>
        </span>
      </button>
    `;
  }

  function render(root) {
    const memories = loadMemories();

    root.innerHTML = `
      <section class="memories-view">
        <header class="page-header">
          <h1 class="page-header__title">Memories</h1>
          <p class="page-header__subtitle">Little moments worth keeping.</p>
        </header>
        <div class="memories-grid">
          ${memories.map(cardHtml).join("")}
        </div>
      </section>
      <div class="modal" id="memory-modal" hidden>
        <div class="modal__backdrop" data-close-modal></div>
        <div class="modal__panel modal__panel--memory" role="dialog" aria-modal="true">
          <button type="button" class="modal__close" data-close-modal aria-label="Close">\u2715</button>
          <div class="modal__memory-image" id="modal-memory-image"></div>
          <div class="modal__memory-body">
            <h2 id="modal-memory-title"></h2>
            <p class="modal__memory-date" id="modal-memory-date"></p>
            <p class="modal__memory-caption" id="modal-memory-caption"></p>
          </div>
        </div>
      </div>
    `;

    memories.forEach((mem) => {
      const card = root.querySelector(`[data-memory-id="${mem.id}"]`);
      card.querySelector(".memory-card__title").textContent = mem.title;
    });

    const modal = root.querySelector("#memory-modal");
    const modalImg = root.querySelector("#modal-memory-image");
    const modalTitle = root.querySelector("#modal-memory-title");
    const modalDate = root.querySelector("#modal-memory-date");
    const modalCaption = root.querySelector("#modal-memory-caption");

    root.querySelectorAll(".memory-card").forEach((card) => {
      card.addEventListener("click", () => {
        const mem = memories.find((m) => m.id === card.getAttribute("data-memory-id"));
        if (!mem) return;
        modalImg.style.background = mem.gradient;
        modalTitle.textContent = mem.title;
        modalDate.textContent = mem.date;
        modalCaption.textContent = mem.caption;
        modal.hidden = false;
      });
    });

    modal.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        modal.hidden = true;
      });
    });
  }

  return { render };
})();

Router.register("memories", Memories.render);
