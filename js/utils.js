// ---------------------------------------------------------
// Small shared helpers. No dependencies.
// ---------------------------------------------------------

const Utils = (() => {

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function dist(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Ease-out cubic — used for graceful, decelerating motion.
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  // Device pixel ratio aware canvas sizing.
  function fitCanvas(canvas, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    // Measure the parent's content box rather than the canvas itself —
    // canvas is a replaced element and some browsers won't stretch it
    // to fill an absolutely-positioned inset:0 box without the fallback
    // below, so sizing from the parent is the reliable source of truth.
    const parent = canvas.parentElement;
    const parentRect = parent && parent !== document.body ? parent.getBoundingClientRect() : null;
    const w = (parentRect && parentRect.width) || window.innerWidth;
    const h = (parentRect && parentRect.height) || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: w, height: h, dpr };
  }

  return { lerp, clamp, rand, dist, easeOutCubic, easeInOutSine, formatTime, fitCanvas };
})();
