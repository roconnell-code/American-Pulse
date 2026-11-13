const SVG = "http://www.w3.org/2000/svg";
const title = document.querySelector("#title");
const about = document.querySelector("#about");
const piece = document.querySelector("#piece");
const further = document.querySelector("#further");
const note = document.querySelector("#note");
const aboutNote = document.querySelector("#about-note");
const begin = document.querySelector("#begin");
const land = document.querySelector("#land");
const nameEl = document.querySelector("#name");
const glow = document.querySelector("#glow");
const dust = document.querySelector("#dust");

function node(tag, attrs) {
  const element = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function openAbout() {
  if (title.classList.contains("is-leaving")) return;
  title.classList.add("is-leaving");
  window.setTimeout(() => {
    title.hidden = true;
    about.hidden = false;
  }, 620);
}

function openPiece() {
  about.classList.add("is-leaving");
  window.setTimeout(() => {
    about.hidden = true;
    about.classList.remove("is-leaving");
    piece.hidden = false;
  }, 480);
}

function showBeat(button, noteEl) {
  for (const item of button.parentElement.querySelectorAll("button")) item.classList.remove("is-on");
  button.classList.add("is-on");
  noteEl.textContent = button.dataset.note;
  noteEl.classList.remove("is-on");
  requestAnimationFrame(() => noteEl.classList.add("is-on"));
}

function openFurther() {
  piece.classList.add("is-leaving");
  window.setTimeout(() => {
    piece.hidden = true;
    piece.classList.remove("is-leaving");
    further.hidden = false;
  }, 480);
}

function backToMap() {
  further.hidden = true;
  piece.hidden = false;
}

begin.addEventListener("click", openAbout);
document.querySelector("#tomap").addEventListener("click", openPiece);
document.querySelector("#more").addEventListener("click", openFurther);
document.querySelector("#back").addEventListener("click", backToMap);
for (const button of about.querySelectorAll(".beats button")) {
  button.addEventListener("pointerenter", () => showBeat(button, aboutNote));
  button.addEventListener("click", () => showBeat(button, aboutNote));
}
for (const button of further.querySelectorAll(".beats button")) {
  button.addEventListener("pointerenter", () => showBeat(button, note));
  button.addEventListener("click", () => showBeat(button, note));
}
window.addEventListener("keydown", (event) => {
  if (title.hidden) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openAbout();
  }
});

window.addEventListener("pointermove", (event) => {
  const x = (event.clientX / window.innerWidth) * 100;
  const y = (event.clientY / window.innerHeight) * 100;
  glow.style.setProperty("--x", `${x}%`);
  glow.style.setProperty("--y", `${y}%`);
});

function paintDust() {
  const context = dust.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const specks = Array.from({ length: 36 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.2 + 0.2,
    v: Math.random() * 0.00004 + 0.000015,
  }));
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    dust.width = Math.floor(window.innerWidth * ratio);
    dust.height = Math.floor(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function frame() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!reduce) {
      for (const speck of specks) {
        speck.y -= speck.v;
        if (speck.y < 0) speck.y = 1;
        context.fillStyle = "rgba(243, 239, 230, 0.35)";
        context.beginPath();
        context.arc(speck.x * window.innerWidth, speck.y * window.innerHeight, speck.r, 0, Math.PI * 2);
        context.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
}

async function paintLand() {
  const geography = await fetch(new URL("../data/geography.json", import.meta.url)).then((response) => response.json());
  const box = geography.viewBox.join(" ");
  land.setAttribute("viewBox", box);
  land.setAttribute("preserveAspectRatio", "xMidYMid meet");
  for (const shape of geography.states) {
    const path = node("path", {
      class: "land-state",
      d: shape.d,
      "data-name": shape.name,
    });
    path.addEventListener("pointerenter", () => show(shape.name, path));
    path.addEventListener("pointerleave", () => hide(path));
    path.addEventListener("click", () => {
      window.location.href = new URL("../index.html", import.meta.url).href;
    });
    land.append(path);
  }
}

function show(label, path) {
  for (const item of land.querySelectorAll(".is-on")) item.classList.remove("is-on");
  path.classList.add("is-on");
  nameEl.textContent = label;
  nameEl.classList.add("is-on");
}

function hide(path) {
  path.classList.remove("is-on");
  nameEl.classList.remove("is-on");
}

paintDust();
paintLand();
