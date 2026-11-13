import { esc, countLine } from "./format.js";

const SVG = "http://www.w3.org/2000/svg";

const SLAB_COLORS = ["#12080c", "#3c1520", "#641e2c", "#2a1420", "#121a2e", "#182848"];

function mountTilt(tilt) {
  if (!tilt) return;
  const rig = tilt.parentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    tilt.style.transform = "rotateX(36deg) rotateY(-12deg)";
    return;
  }
  let px = 0;
  let py = 0;
  let active = false;
  let x = 36;
  let y = -12;
  rig.addEventListener("pointermove", (event) => {
    const box = rig.getBoundingClientRect();
    px = (event.clientX - box.left) / box.width - 0.5;
    py = (event.clientY - box.top) / box.height - 0.5;
    active = true;
  });
  rig.addEventListener("pointerleave", () => {
    active = false;
  });
  function frame(now) {
    const goalX = 36 + Math.sin(now / 4200) * 2 + (active ? -py * 5 : 0);
    const goalY = Math.sin(now / 5600) * 14 + (active ? px * 10 : 0);
    x += (goalX - x) * 0.045;
    y += (goalY - y) * 0.045;
    tilt.style.transform = `rotateX(${x.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function node(name, attrs = {}) {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

export function mountMap(svg, geography, states, handlers) {
  const meta = new Map(states.map((state) => [state.abbr, state]));
  const view = {
    full: geography.focus.full,
    northeast: geography.focus.northeast,
    south: geography.focus.south,
    west: geography.focus.west,
  };
  let current = view.full.slice();
  let frame = 0;
  const counts = {};
  const depth = {};
  let selected = null;
  const surfaces = [];
  const tilt = svg.parentElement;

  function applyView(box) {
    const value = box.join(" ");
    for (const surface of surfaces) surface.setAttribute("viewBox", value);
  }

  SLAB_COLORS.forEach((color, index) => {
    const slab = node("svg", { class: "slab", "aria-hidden": "true", preserveAspectRatio: "xMidYMid meet" });
    slab.style.color = color;
    slab.style.transform = `translateZ(${(index - SLAB_COLORS.length) * 4}px)`;
    const group = node("g");
    for (const shape of geography.states) group.append(node("path", { d: shape.d }));
    slab.append(group);
    tilt.insertBefore(slab, svg);
    surfaces.push(slab);
  });

  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.innerHTML = "";
  surfaces.push(svg);

  const defs = node("defs");
  const plate = node("linearGradient", { id: "state-plate", x1: "0", y1: "0", x2: "0", y2: "1" });
  plate.append(
    node("stop", { offset: "0", "stop-color": "#2a4574" }),
    node("stop", { offset: "0.46", "stop-color": "#152743" }),
    node("stop", { offset: "1", "stop-color": "#0b1628" }),
  );
  defs.append(plate);
  svg.append(defs);

  const layer = node("g", { class: "states" });
  for (const shape of geography.states) {
    const info = meta.get(shape.abbr) || shape;
    const path = node("path", {
      class: "state",
      d: shape.d,
      "data-abbr": shape.abbr,
      role: "button",
      tabindex: "0",
      "aria-pressed": "false",
      "aria-label": `${info.name}, ${info.region || "United States"}`,
    });
    path.addEventListener("pointerenter", () => handlers.hover(info));
    path.addEventListener("pointerleave", () => handlers.hover(null));
    path.addEventListener("focus", () => handlers.hover(info));
    path.addEventListener("blur", () => handlers.hover(null));
    path.addEventListener("click", () => handlers.select(shape.abbr));
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlers.select(shape.abbr);
      }
    });
    layer.append(path);
  }
  svg.append(layer);
  applyView(current);
  mountTilt(tilt);
  svg.addEventListener("pointerleave", () => handlers.hover(null));

  function applyCounts() {
    for (const path of layer.children) {
      const abbr = path.dataset.abbr;
      const count = counts[abbr];
      const info = meta.get(abbr);
      path.classList.toggle("has-news", Number(count) > 0);
      const line = countLine(Number(count || 0), depth[abbr]);
      path.setAttribute("aria-label", `${info?.name || abbr}. ${line}`);
    }
  }

  function animateTo(next) {
    const from = current.slice();
    cancelAnimationFrame(frame);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      current = next.slice();
      applyView(current);
      return;
    }
    const start = performance.now();
    function step(now) {
      const progress = Math.min(1, (now - start) / 720);
      const eased = 1 - (1 - progress) ** 3;
      current = from.map((value, index) => value + (next[index] - value) * eased);
      applyView(current.map((value) => Number(value.toFixed(1))));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  return {
    setSelected(abbr) {
      selected = abbr;
      for (const path of layer.children) {
        const on = path.dataset.abbr === abbr;
        path.classList.toggle("is-selected", on);
        path.setAttribute("aria-pressed", on ? "true" : "false");
      }
    },
    setCounts(nextCounts, nextDepth) {
      Object.assign(counts, nextCounts);
      Object.assign(depth, nextDepth);
      applyCounts();
    },
    setFocus(name) {
      if (view[name]) animateTo(view[name]);
    },
    describe(info) {
      if (!info) {
        if (!selected) return null;
        info = meta.get(selected);
      }
      if (!info) return null;
      return { title: info.name };
    },
    indexMeta: meta,
  };
}

export function readoutHtml(description) {
  if (!description) return "";
  return esc(description.title);
}
