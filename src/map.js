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
    if (tilt.dataset.panning === "true") {
      requestAnimationFrame(frame);
      return;
    }
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
  enableNavigation();

  function clientToUser(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return point.matrixTransform(matrix.inverse());
  }

  function enableNavigation() {
    const aspect = view.full[2] / view.full[3];
    const minWidth = view.full[2] / 8;
    const maxWidth = view.full[2] * 1.35;
    let drag = null;

    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const path = event.target?.classList?.contains("state") ? event.target : null;
      cancelAnimationFrame(frame);
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        path,
      };
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      if (!drag.moved && distance < 12) return;
      const before = clientToUser(drag.x, drag.y);
      const after = clientToUser(event.clientX, event.clientY);
      drag.moved = true;
      drag.x = event.clientX;
      drag.y = event.clientY;
      tilt.dataset.panning = "true";
      svg.classList.add("is-panning");
      if (!before || !after) return;
      current[0] += before.x - after.x;
      current[1] += before.y - after.y;
      applyView(current);
    });

    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const { moved, path } = drag;
      drag = null;
      delete tilt.dataset.panning;
      svg.classList.remove("is-panning");
      if (!moved && path) {
        path.blur();
        handlers.select(path.dataset.abbr);
      }
    }

    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      const before = clientToUser(event.clientX, event.clientY);
      const factor = Math.exp(event.deltaY * 0.0011);
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, current[2] * factor));
      const applied = nextWidth / current[2];
      current[2] = nextWidth;
      current[3] = current[3] * applied;
      if (Math.abs(current[2] / current[3] - aspect) > 0.02) current[3] = current[2] / aspect;
      applyView(current);
      const after = clientToUser(event.clientX, event.clientY);
      if (before && after) {
        current[0] += before.x - after.x;
        current[1] += before.y - after.y;
        applyView(current);
      }
    }, { passive: false });
  }

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
