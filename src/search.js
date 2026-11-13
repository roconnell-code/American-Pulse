import { esc } from "./format.js";

export function mountSearch(layer, states, handlers) {
  const input = layer.querySelector("#search-input");
  const results = layer.querySelector("#search-results");
  let matches = states.slice();
  let active = 0;

  function render() {
    const query = input.value.trim();
    const needle = query.toLowerCase();
    matches = states.filter((state) => {
      if (!needle) return true;
      return state.name.toLowerCase().includes(needle)
        || state.abbr.toLowerCase() === needle
        || state.capital.toLowerCase().includes(needle)
        || state.region.toLowerCase().includes(needle);
    }).slice(0, 8);
    active = Math.min(active, Math.max(matches.length - 1, 0));
    const stateRows = matches.map((state, index) => `
      <button type="button" class="search-row ${index === active ? "is-active" : ""}" data-abbr="${esc(state.abbr)}">
        <b>${esc(state.abbr)}</b>
        <span>${esc(state.name)}</span>
        <em>${esc(state.region)} · ${esc(state.capital)}</em>
      </button>
    `).join("");
    const searchRow = query.length >= 2
      ? `<button type="button" class="search-row story" data-action="stories"><span>Search stories for “${esc(query)}”</span><em>Past 7 days</em></button>`
      : "";
    results.innerHTML = stateRows + searchRow || `<p class="search-empty">No state by that name.</p>`;
  }

  function open() {
    layer.hidden = false;
    input.value = "";
    active = 0;
    render();
    input.focus();
  }

  function close() {
    layer.hidden = true;
  }

  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = Math.min(matches.length - 1, active + 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(0, active - 1);
      render();
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      if (input.value.trim().length >= 2) {
        close();
        handlers.search(input.value.trim());
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const state = matches[active];
      if (state) {
        close();
        handlers.select(state.abbr);
      }
    } else if (event.key === "Escape") {
      close();
    }
  });
  results.addEventListener("click", (event) => {
    const row = event.target.closest("[data-abbr]");
    if (row) {
      close();
      handlers.select(row.dataset.abbr);
    }
    if (event.target.closest("[data-action='stories']")) {
      close();
      handlers.search(input.value.trim());
    }
  });
  layer.addEventListener("click", (event) => {
    if (event.target === layer) close();
  });

  return { open, close, isOpen: () => !layer.hidden };
}
