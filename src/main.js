import { startParticles } from "./fx.js";
import { mountMap, readoutHtml } from "./map.js";
import { bindPanel, renderPanel } from "./panel.js";
import { mountSearch } from "./search.js";
import { esc } from "./format.js";

const UNAVAILABLE = "News is unavailable. The live feeds did not respond, so no stories are shown.";
const model = {
  mode: "national",
  category: "all",
  range: "7",
  filter: "",
  caret: 0,
  keepFocus: false,
  selected: null,
  payload: null,
  loading: true,
  searchQuery: "",
  counts: {},
  depth: {},
};

const clock = document.querySelector("#clock");
const ticker = document.querySelector("#ticker");
const livePill = document.querySelector("#live-pill");
const readout = document.querySelector("#readout");
const intel = document.querySelector("#intel-body");
const status = document.querySelector("#index-status");
const liveRegion = document.querySelector("#live-region");
const index = document.querySelector("#state-index");

let states = [];
let map;
let search;
let tickerItems = [];
let tickerCursor = 0;
let pollTimer = 0;

function paintClock() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "2-digit", year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short",
  }).format(now);
  clock.textContent = `${date}  ·  ${time}`.toUpperCase();
}

function setLive(mode) {
  livePill.dataset.state = mode;
  livePill.querySelector("span").textContent = mode === "live" ? "Live news" : mode === "down" ? "Feed offline" : "Linking";
}

function renderTicker() {
  if (!ticker) return;
  const article = tickerItems[tickerCursor % Math.max(tickerItems.length, 1)];
  if (!article) return;
  ticker.textContent = article.title;
}

function syncTicker(articles) {
  tickerItems = articles || [];
  tickerCursor = 0;
  renderTicker();
}

function currentState() {
  return states.find((item) => item.abbr === model.selected) || null;
}

function paint() {
  renderPanel(intel, {
    ...model,
    stateInfo: currentState(),
  });
  model.keepFocus = false;
  const description = map?.describe(null);
  if (!model.hovering) readout.innerHTML = readoutHtml(description);
  for (const button of index.querySelectorAll("button")) {
    button.classList.toggle("is-selected", button.dataset.abbr === model.selected);
    button.setAttribute("aria-selected", button.dataset.abbr === model.selected ? "true" : "false");
  }
  const full = Object.values(model.depth).filter((item) => item === "full").length;
  status.textContent = full ? `Local index ${full}/51` : "Indexing local news";
  document.title = model.selected ? `${currentState()?.name || "State"} — American Pulse` : "American Pulse";
}

const site = new URL("../", import.meta.url);

async function getNews(params) {
  const response = await fetch(new URL(`api/news?${new URLSearchParams(params)}`, site));
  if (!response.ok) throw new Error(UNAVAILABLE);
  return response.json();
}

let requestSerial = 0;

async function loadNational() {
  const request = ++requestSerial;
  model.mode = "national";
  model.selected = null;
  map?.setSelected(null);
  model.loading = true;
  model.payload = null;
  paint();
  try {
    const payload = await getNews({ scope: "national" });
    model.nationalPayload = payload;
    if (request !== requestSerial) return;
    model.payload = payload;
    model.loading = false;
    setLive(payload.ok ? "live" : "down");
    syncTicker(payload.articles || []);
  } catch {
    if (request !== requestSerial) return;
    model.payload = { ok: false, articles: [], error: UNAVAILABLE, message: UNAVAILABLE };
    model.loading = false;
    setLive("down");
  }
  paint();
}

async function selectState(abbr) {
  const info = states.find((item) => item.abbr === abbr);
  if (!info) return;
  const request = ++requestSerial;
  model.mode = "state";
  model.selected = abbr;
  model.category = "all";
  model.filter = "";
  model.loading = true;
  model.payload = null;
  map.setSelected(abbr);
  liveRegion.textContent = `Opening ${info.name}.`;
  paint();
  try {
    const payload = await getNews({ scope: "state", id: abbr });
    if (request !== requestSerial) return;
    model.payload = payload;
    model.loading = false;
    if (payload.ok) {
      model.counts[abbr] = (payload.articles || []).length;
      model.depth[abbr] = "full";
      map.setCounts(model.counts, model.depth);
      syncTicker(payload.articles || []);
      setLive("live");
    } else setLive("down");
  } catch {
    if (request !== requestSerial) return;
    model.payload = { ok: false, articles: [], error: UNAVAILABLE, message: UNAVAILABLE };
    model.loading = false;
    setLive("down");
  }
  paint();
}

async function runSearch(query) {
  const request = ++requestSerial;
  model.mode = "search";
  model.searchQuery = query;
  model.category = "all";
  model.filter = "";
  model.loading = true;
  model.payload = null;
  paint();
  try {
    const payload = await getNews({ scope: "search", q: query });
    if (request !== requestSerial) return;
    model.payload = payload;
    model.loading = false;
    setLive(payload.ok ? "live" : "down");
  } catch {
    if (request !== requestSerial) return;
    model.payload = { ok: false, articles: [], error: UNAVAILABLE, message: UNAVAILABLE };
    model.loading = false;
  }
  paint();
}

function showNational() {
  requestSerial += 1;
  model.mode = "national";
  model.selected = null;
  model.category = "all";
  model.filter = "";
  map.setSelected(null);
  model.loading = false;
  model.payload = model.nationalPayload || { ok: false, articles: [], error: UNAVAILABLE, message: UNAVAILABLE };
  syncTicker(model.nationalPayload?.articles || []);
  setLive(model.payload.ok ? "live" : "down");
  paint();
}

async function refreshCounts() {
  try {
    const payload = await getNews({ scope: "counts" });
    if (!payload.counts) return;
    const previousCounts = model.counts;
    const previousDepth = model.depth;
    model.counts = { ...payload.counts };
    model.depth = { ...payload.depth };
    for (const [abbr, level] of Object.entries(previousDepth)) {
      if (level === "full") {
        model.depth[abbr] = "full";
        model.counts[abbr] = previousCounts[abbr];
      }
    }
    map.setCounts(model.counts, model.depth);
    const full = Object.values(model.depth).filter((item) => item === "full").length;
    status.textContent = full ? `Local index ${full}/51` : payload.pending ? `Indexing local news · ${51 - payload.pending}/51` : "Indexing local news";
    if (!model.hovering) readout.innerHTML = readoutHtml(map.describe(null));
    if (payload.pending === 0) window.clearInterval(pollTimer);
  } catch {
    /* The map keeps the counts it already has. */
  }
}

function bindChrome() {
  setInterval(() => {
    if (!ticker || !tickerItems.length) return;
    tickerCursor = (tickerCursor + 1) % tickerItems.length;
    renderTicker();
  }, 5600);

  document.querySelector("#focus-seg").addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus]");
    if (!button) return;
    for (const item of event.currentTarget.querySelectorAll("button")) {
      const on = item === button;
      item.classList.toggle("is-on", on);
      item.setAttribute("aria-pressed", on ? "true" : "false");
    }
    map.setFocus(button.dataset.focus);
  });

  index.addEventListener("click", (event) => {
    const button = event.target.closest("[data-abbr]");
    if (button) selectState(button.dataset.abbr);
  });

  bindPanel(document.querySelector("#intel"), {
    category(id) {
      model.category = id;
      paint();
    },
    range(id) {
      model.range = id;
      paint();
    },
    filter(value, caret) {
      model.filter = value;
      model.caret = caret;
      model.keepFocus = true;
      paint();
    },
    action(name) {
      if (name === "national") showNational();
        if (name === "retry") {
        if (model.mode === "state" && model.selected) selectState(model.selected);
        else if (model.mode === "search") runSearch(model.searchQuery);
        else loadNational();
      }
    },
  });

  search = mountSearch(document.querySelector("#search-layer"), states, {
    select: selectState,
    search: runSearch,
  });
  const about = document.querySelector("#about-layer");
  document.querySelector("#search-open").addEventListener("click", () => search.open());
  document.querySelector("#about-open").addEventListener("click", () => {
    about.hidden = false;
  });
  document.querySelector("#about-close").addEventListener("click", () => {
    about.hidden = true;
  });
  about.addEventListener("click", (event) => {
    if (event.target === about) about.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (event.key === "Escape") {
      if (!document.querySelector("#search-layer").hidden) search.close();
      else if (!about.hidden) about.hidden = true;
      else if (model.mode !== "national") showNational();
    } else if (!typing && (event.key === "/" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"))) {
      event.preventDefault();
      search.open();
    }
  });
}

function buildIndex() {
  index.innerHTML = states.map((state) => `
    <button type="button" role="option" data-abbr="${esc(state.abbr)}" aria-selected="false" title="${esc(state.name)}">${esc(state.abbr)}</button>
  `).join("");
}

async function boot() {
  startParticles(document.querySelector("#particles"));
  paintClock();
  setInterval(paintClock, 1000);
  const [stateList, geography] = await Promise.all([
    fetch(new URL("data/states.json", site)).then((response) => response.json()),
    fetch(new URL("data/geography.json", site)).then((response) => response.json()),
  ]);
  states = stateList;
  buildIndex();
  map = mountMap(document.querySelector("#map"), geography, states, {
    hover(info) {
      model.hovering = info;
      readout.innerHTML = readoutHtml(info ? map.describe(info) : map.describe(null));
    },
    select: selectState,
  });
  bindChrome();
  await loadNational();
  model.nationalPayload = model.payload;
  refreshCounts();
  pollTimer = window.setInterval(refreshCounts, 7000);
}

boot().catch(() => {
  intel.innerHTML = `<div class="empty"><span class="ring"></span><p>${esc(UNAVAILABLE)}</p></div>`;
  setLive("down");
});
