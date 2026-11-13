export function startParticles(canvas) {
  const context = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dots = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.3 + 0.3,
    v: Math.random() * 0.000045 + 0.00002,
    a: Math.random() * 0.28 + 0.05,
  }));

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function frame() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    context.clearRect(0, 0, width, height);
    if (!reduce) {
      for (const dot of dots) {
        dot.y -= dot.v;
        if (dot.y < 0) {
          dot.y = 1;
          dot.x = Math.random();
        }
        context.fillStyle = `rgba(244, 239, 228, ${dot.a})`;
        context.beginPath();
        context.arc(dot.x * width, dot.y * height, dot.r, 0, Math.PI * 2);
        context.fill();
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(frame);
}

export function tweenNumber(node, next) {
  const target = Number(next) || 0;
  const from = Number(node.dataset.value || 0);
  node.dataset.value = String(target);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = String(target);
    return;
  }
  const start = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - start) / 520);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = String(Math.round(from + (target - from) * eased));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
