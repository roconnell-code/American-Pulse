import { CATEGORIES, esc, formatFull, inRange } from "./format.js";

function cards(articles) {
  if (!articles.length) {
    return `<div class="empty"><span class="ring"></span><p>Nothing fits those filters.</p></div>`;
  }
  return articles.map((article, index) => `
    <a class="card" style="animation-delay:${Math.min(index, 12) * 42}ms" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">
      <div class="thumb">
        ${article.image ? `<img src="${esc(article.image)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
        <span>${esc(article.categoryLabel || "Report")}</span>
      </div>
      <div class="card-copy">
        <h3>${esc(article.title)}</h3>
        ${article.summary
          ? `<p class="summary">${esc(article.summary)}</p>`
          : `<p class="summary missing">The paper didn't include a summary.</p>`}
        <div class="card-foot">
          <span class="publisher">${esc(article.publisher)}</span>
          <time datetime="${esc(article.publishedAt)}">${esc(formatFull(article.publishedAt))}</time>
        </div>
      </div>
    </a>
  `).join("");
}

function skeletons() {
  return Array.from({ length: 4 }, () => `
    <div class="card skeleton-card" aria-hidden="true">
      <div class="thumb skeleton"></div>
      <div class="card-copy">
        <div class="skeleton line short"></div>
        <div class="skeleton line"></div>
        <div class="skeleton line mid"></div>
      </div>
    </div>
  `).join("");
}

function visibleArticles(payload, model) {
  const articles = payload?.articles || [];
  const query = model.filter.trim().toLowerCase();
  return articles.filter((article) => {
    if (model.category !== "all" && article.category !== model.category) return false;
    if (!inRange(article.publishedAt, model.range)) return false;
    if (!query) return true;
    const haystack = `${article.title} ${article.publisher} ${article.summary || ""}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function renderPanel(root, model) {
  const payload = model.payload;
  const articles = payload?.articles || [];
  const shown = payload?.ok ? visibleArticles(payload, model) : [];
  const state = model.stateInfo;
  const title = model.mode === "state" && state
    ? state.name
    : model.mode === "search"
      ? model.searchQuery
      : "The country";
  const failed = payload && payload.ok === false;
  const empty = payload?.ok && !articles.length;

  root.innerHTML = `
    <header class="intel-head">
      <div class="intel-title">
        <h2>${esc(title)}</h2>
      </div>
      <div class="tools">
        <div class="chips" role="tablist" aria-label="Category">
          ${CATEGORIES.filter(([id]) => id === "all" || articles.some((article) => article.category === id)).map(([id, label]) => `<button type="button" class="chip ${model.category === id ? "is-on" : ""}" data-category="${id}" aria-pressed="${model.category === id}">${label}</button>`).join("")}
        </div>
        <div class="seg" role="group" aria-label="Publication window">
          ${[["24", "Today"], ["72", "3 days"], ["7", "Week"]].map(([id, label]) => `<button type="button" data-range="${id}" class="${model.range === id ? "is-on" : ""}" aria-pressed="${model.range === id}">${label}</button>`).join("")}
        </div>
        <input id="story-filter" class="filter-input" type="search" placeholder="Search stories" value="${esc(model.filter)}" autocomplete="off">
      </div>
    </header>
    <div class="intel-scroll">
      ${payload?.notice ? `<p class="notice">${esc(payload.notice)}</p>` : ""}
      ${model.loading ? `<p class="loading-copy">Looking up this week's stories.</p>${skeletons()}` : ""}
      ${!model.loading && failed ? `<div class="empty"><span class="ring"></span><p>${esc(payload.error || payload.message)}</p><button type="button" class="hud-btn" data-action="retry">Try the feed again</button></div>` : ""}
      ${!model.loading && empty ? `<div class="empty"><span class="ring"></span><p>${esc(payload.message || "No articles from the past 7 days matched.")}</p></div>` : ""}
      ${!model.loading && payload?.ok && articles.length ? `${shown.length !== articles.length ? `<p class="result-count">${shown.length} of ${articles.length}</p>` : ""}${cards(shown)}` : ""}
    </div>
  `;

  if (model.keepFocus) {
    const input = root.querySelector("#story-filter");
    if (input) {
      input.focus();
      const position = model.caret ?? input.value.length;
      input.setSelectionRange(position, position);
    }
  }
}

export function bindPanel(root, handlers) {
  root.addEventListener("click", (event) => {
    const category = event.target.closest("[data-category]");
    if (category) handlers.category(category.dataset.category);
    const range = event.target.closest("[data-range]");
    if (range) handlers.range(range.dataset.range);
    const action = event.target.closest("[data-action]");
    if (action) handlers.action(action.dataset.action);
  });
  root.addEventListener("input", (event) => {
    if (event.target.id === "story-filter") {
      handlers.filter(event.target.value, event.target.selectionStart);
    }
  });
}
